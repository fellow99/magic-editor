import './assets/index.css'

import MagicEditor from './components/magic-editor.vue'
import MagicContextMenu from './components/common/magic-contextmenu/index.js'
import Modal from './components/common/modal/index.js'

export function install(app) {
    if (install.installed) return
    install.installed = true
    app.component('MagicEditor', MagicEditor)
    app.use(MagicContextMenu)
    app.use(Modal)
}

const plugin = {
    install
}

if (typeof window !== 'undefined' && window.Vue) {
    window.Vue.use(plugin)
}

export default MagicEditor
