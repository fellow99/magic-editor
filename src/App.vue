<template>
  <div id="app">
    <magic-editor :config="config"/>
  </div>
</template>

<script>
import MagicEditor from '@/components/magic-editor.vue'

export default {
  name: 'App',
  components: {
    MagicEditor,
  },
  data() {
    let defaultConfig = {};
    try {
      if (parent && parent.MAGIC_EDITOR_CONFIG) {
        defaultConfig = {...parent.MAGIC_EDITOR_CONFIG};
      }
    } catch (ignored) {
    }
    if (window.MAGIC_EDITOR_CONFIG) {
      defaultConfig = {...defaultConfig, ...window.MAGIC_EDITOR_CONFIG}
    }
    // Detect dev mode: Vite dev server runs on port 5173/5174, or use import.meta.env.DEV
    const isDev = import.meta.env.VITE_DEV_MODE;
    defaultConfig.baseURL = isDev ? '/magic/web' : './';
    defaultConfig.serverURL = isDev ? '/magic/web' : './';
    defaultConfig.inJar = true;
    return {
      config: defaultConfig
    }
  }
}
</script>

<style>
html,
body,
#app {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
}
</style>
