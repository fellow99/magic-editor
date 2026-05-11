<template>
  <div id="app">
    <magic-editor :config="config"/>
  </div>
</template>

<script>
import MagicEditor from 'magic-editor'
import '../dist/magic-editor.css'

export default {
  name: 'Test',
  components: {
    MagicEditor
  },
  data() {
    return {
      config: {
        baseURL: '/magic/web',
        serverURL: 'http://localhost:9999/',
        inJar: true
      }
    }
  }
}
</script>

<style>
html, body, #app {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
}
</style>
