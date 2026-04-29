import { createApp } from 'vue'
import App from './App.vue'
import MagicContextMenu from './components/common/magic-contextmenu'
import Modal from './components/common/modal'

const app = createApp(App)

app.use(MagicContextMenu)
app.use(Modal)

app.mount('#app')
