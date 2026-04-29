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
    defaultConfig.baseURL = import.meta.env.DEV ? 'http://localhost:9999/magic/web' : './';
    defaultConfig.serverURL = import.meta.env.DEV ? 'http://localhost:9999/' : './';
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
