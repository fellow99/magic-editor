import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

const resolve = dir => path.join(__dirname, dir)

function monacoEditorLocalesPlugin(options = {}) {
  const languages = options.languages || []
  const defaultLanguage = options.defaultLanguage || languages[0] || ''
  const mapLanguages = options.mapLanguages || {}

  const mapEmbedLangName = {}
  const mapEmbedLangNameSelf = {}

  if (languages.includes('zh-cn')) {
    try {
      mapEmbedLangName['zh-cn'] = require('./plugins/editor.main.nls.zh-cn.js')
    } catch(e) {}
    mapEmbedLangNameSelf['zh-cn'] = {}
  }
  if (languages.includes('en')) {
    try {
      mapEmbedLangName['en'] = require('./plugins/editor.main.nls.en.js')
    } catch(e) {}
    mapEmbedLangNameSelf['en'] = {}
  }

  const mapLangIdx = {}
  let langIdx = 0
  const enLang = mapEmbedLangName['en'] || {}
  function collectEnIdx(obj) {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        if (!(obj[key] in mapLangIdx)) {
          mapLangIdx[obj[key]] = langIdx++
        }
      } else if (typeof obj[key] === 'object' && obj[key]) {
        collectEnIdx(obj[key])
      }
    }
  }
  collectEnIdx(enLang)

  const lang = {}
  for (const l of languages) {
    if (!(l in mapEmbedLangName)) continue
    const langObj = mapEmbedLangName[l]
    if (!langObj) continue
    const rstObj = lang[l] = {}
    function collectLangIdx(en, target, translated) {
      for (const key in en) {
        if (typeof en[key] === 'string' && typeof translated[key] === 'string') {
          if (en[key] in mapLangIdx) {
            rstObj[mapLangIdx[en[key]]] = translated[key]
          }
        } else if (typeof en[key] === 'object' && typeof translated[key] === 'object') {
          collectLangIdx(en[key], target, translated[key])
        }
      }
    }
    collectLangIdx(enLang, rstObj, langObj)

    const objSelf = mapEmbedLangNameSelf[l]
    if (objSelf) {
      for (const key in objSelf) {
        if (key in mapLangIdx) {
          rstObj[mapLangIdx[key]] = objSelf[key]
        }
      }
    }
    const userLang = mapLanguages[l]
    if (userLang) {
      for (const key in userLang) {
        if (key in mapLangIdx) {
          rstObj[mapLangIdx[key]] = userLang[key]
        }
      }
    }
  }

  return {
    name: 'monaco-editor-locales',
    transform(code, id) {
      if (id.replace(/\\/g, '/').includes('esm/vs/nls.js')) {
        code = code.replace(/export function localize/, 'function _ocalize')

        const endl = '\n'
        code += endl + 'function localize(data, message) {'
        code += endl + '  if(typeof(message) === "string"){'
        code += endl + '    var idx = localize.mapLangIdx[message] || -1;'
        code += endl + '    var nlsLang = localize.mapNlsLang[localize.selectLang] || {};'
        code += endl + ''
        code += endl + '    if(idx in nlsLang){'
        code += endl + '      message = nlsLang[idx];'
        code += endl + '    }'
        code += endl + '  }'
        code += endl + ''
        code += endl + '  var args = [];'
        code += endl + '  for(var i = 0; i < arguments.length; ++i){'
        code += endl + '    args.push(arguments[i]);'
        code += endl + '  }'
        code += endl + '  args[1] = message;'
        code += endl + '  return _ocalize.apply(this, args);'
        code += endl + '}'
        code += endl + 'localize.selectLang = ' + JSON.stringify(defaultLanguage) + ';'
        code += endl + 'localize.mapLangIdx = ' + JSON.stringify(mapLangIdx) + ';'
        code += endl + 'localize.mapNlsLang = ' + JSON.stringify(lang) + ';'
        code += endl + ''
        code += endl + 'export { localize };'

        return { code, map: null }
      }
      return null
    }
  }
}

export default defineConfig(({ mode }) => {
  const isLib = mode === 'lib'
  loadEnv(mode, process.cwd(), '')

  const maVersion = require('./package.json').version

  const baseConfig = {
    plugins: [
      vue(),
      monacoEditorLocalesPlugin({
        languages: ['zh-cn'],
        defaultLanguage: 'zh-cn',
        logUnmatched: false,
      })
    ],
    resolve: {
      alias: {
        '@': resolve('src'),
        'public': resolve('public')
      }
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode === 'development' ? 'development' : 'production'),
      'process.env.VUE_APP_MA_VERSION': JSON.stringify(maVersion),
    },
    css: {
      preprocessorOptions: {
        less: {
          javascriptEnabled: true
        }
      }
    }
  }

  if (isLib) {
    return {
      ...baseConfig,
      build: {
        lib: {
          entry: resolve('src/index.js'),
          name: 'MagicEditor',
          fileName: (format) => `magic-editor.${format}.js`,
          formats: ['umd', 'es']
        },
        outDir: 'dist',
        sourcemap: false,
        rollupOptions: {
          external: ['vue'],
          output: {
            globals: {
              vue: 'Vue'
            },
            assetFileNames: (assetInfo) => {
              if (assetInfo.name === 'style.css') return 'magic-editor.css'
              return assetInfo.name
            }
          }
        }
      },
      optimizeDeps: {
        include: ['monaco-editor']
      }
    }
  }

  return {
    ...baseConfig,
    base: './',
    build: {
      outDir: 'dist-app',
      sourcemap: false,
      rollupOptions: {
        input: path.resolve(__dirname, 'index.html'),
        output: {
          entryFileNames: 'js/[name].[hash].js',
          chunkFileNames: 'js/[name].[hash].js',
          assetFileNames: (assetInfo) => {
            if (assetInfo.name && assetInfo.name.endsWith('.css')) {
              return 'css/[name].[hash][extname]'
            }
            return 'assets/[name].[hash][extname]'
          }
        }
      }
    },
    server: {
      open: false,
      host: true,
      watch: {
        usePolling: true,
        interval: 1000,
      },
      hmr: {
        overlay: true,
      },
      proxy: {
        '/magic': {
          target: 'http://localhost:9999',
          changeOrigin: true,
          ws: true,
        }
      }
    }
  }
})
