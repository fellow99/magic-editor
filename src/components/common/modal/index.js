import { createApp, h } from 'vue'
import MagicAlert from './magic-alert.vue'
import MagicConfirm from './magic-confirm.vue'
import MagicDialog from './magic-dialog.vue'

function createModalProxy(Component) {
    return function(options) {
        const container = document.createElement('div')
        document.body.appendChild(container)

        const app = createApp({
            data() {
                return {
                    visible: true,
                    ...options
                }
            },
            render() {
                const props = { visible: this.visible }
                for (let key in options) {
                    if (options[key] !== undefined && options[key] !== null) {
                        props[key] = this[key]
                    }
                }
                return h(Component, props)
            }
        })

        app.mount(container)

        const maContainer = document.getElementsByClassName('ma-container')[0]
        if (maContainer) {
            maContainer.append(container)
        }
    }
}

const MagicAlertProxy = createModalProxy(MagicAlert)
const MagicConfirmProxy = createModalProxy(MagicConfirm)
const MagicDialogProxy = createModalProxy(MagicDialog)

function install(app) {
    app.config.globalProperties.$magicAlert = MagicAlertProxy
    app.config.globalProperties.$magicConfirm = MagicConfirmProxy
    app.config.globalProperties.$magicDialog = MagicDialogProxy
}

const modal = {
    magicAlert: MagicAlertProxy,
    magicConfirm: MagicConfirmProxy,
    magicDialog: MagicDialogProxy
}

export default {
    install
}

export {modal}
