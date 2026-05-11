import { createApp } from 'vue'
import Test from './Test.vue'
import { install } from 'magic-editor'

const app = createApp(Test)

app.use(install)

app.mount('#app')
