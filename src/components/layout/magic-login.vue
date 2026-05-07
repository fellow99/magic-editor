<template>
  <magic-dialog v-show="true" :moveable="false" :shade="true" :showClose="false" :title="$t('login.magic.title')">
    <template #content>
      <label>{{ $t('login.magic.username') }}</label>
      <magic-input :onEnter="doLogin" v-model:value="username"/>
      <div style="height: 2px"/>
      <label>{{ $t('login.magic.password') }}</label>
      <magic-input :onEnter="doLogin" v-model:value="password" type="password"/>
    </template>
    <template #buttons>
      <button class="ma-button active" @click="doLogin">{{ $t('login.magic.loginButton') }}</button>
    </template>
  </magic-dialog>
</template>

<script>
import MagicInput from '@/components/common/magic-input.vue'
import MagicDialog from '@/components/common/modal/magic-dialog.vue'
import { login } from '@/api/web.js'
import contants from '@/scripts/contants.js'
import store from '@/scripts/store.js'
import bus from "@/scripts/bus.js";

export default {
  name: 'MagicLogin',
  props: {
    onLogin: Function,
  },
  components: {
    MagicInput,
    MagicDialog,
  },
  data() {
    return {
      username: '',
      password: '',
    }
  },
  methods: {
    doLogin() {
      login(this.username, this.password).success((res, response) => {
        if (res) {
          bus.$emit('status', this.$t('login.magic.success'))
          contants.HEADER_MAGIC_TOKEN_VALUE = response.headers[contants.HEADER_MAGIC_TOKEN];
          store.set(contants.HEADER_MAGIC_TOKEN, contants.HEADER_MAGIC_TOKEN_VALUE);
          this.onLogin();
        } else {
          bus.$emit('status', this.$t('login.magic.failure'))
          this.$magicAlert({
            title: this.$t('login.magic.title'),
            content: this.$t('login.magic.failureMessage')
          })
        }
      })
    },
  },
}
</script>
<style scoped>
label {
  width: 80px;
  text-align: right;
  display: inline-block;
}
</style>