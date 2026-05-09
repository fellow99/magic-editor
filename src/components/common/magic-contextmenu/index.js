import { createApp } from 'vue'
import Contextmenu from "./Contextmenu.vue"
import Submenu from "./Submenu.vue"
import {COMPONENT_NAME} from "./constant"
import {getMountTarget} from "./util.js"

let lastInstance = null
let lastApp = null

function ContextmenuProxy(options) {
    const container = document.createElement('div')
    getMountTarget().appendChild(container)

    const app = createApp(Contextmenu, {
        menus: options.menus,
        position: {
            x: options.x || (options.event ? options.event.clientX : 0),
            y: options.y || (options.event ? options.event.clientY : 0)
        },
        customClass: options.customClass,
        minWidth: options.minWidth,
        zIndex: options.zIndex,
        destroy: options.destroy
    })
    app.component(COMPONENT_NAME, Submenu)

    ContextmenuProxy.destroy()
    lastApp = app
    lastInstance = app.mount(container)
}

ContextmenuProxy.destroy = function() {
    if (lastApp) {
        lastApp.unmount()
        lastApp = null
        lastInstance = null
    }
}

function install(app) {
    app.config.globalProperties.$magicContextmenu = ContextmenuProxy
}

export default {
    install
}
