<template>
  <div @click="onClick" :style="{width}">
    <input :readonly="readonly" :placeholder="placeholder" :type="type" :value="modelValue !== undefined ? modelValue : value" @focus="focus"
           @input="(e) => {$emit('update:modelValue', e.target.value),$emit('update:value', e.target.value),$emit('input', e.target.value)}"
           @keyup.enter.stop="onEnter"/>
    <span v-if="icon"><i :class="'ma-icon ma-icon-' + icon"/></span>
  </div>
</template>

<script>
export default {
  name: 'MagicInput',
  props: {
    type: {
      type: String,
      default: 'text',
    },
    placeholder: {
      type: String,
      default: '',
    },
    value: String,
    // Vue3 v-model 使用 modelValue，兼容旧的 value prop
    modelValue: String,
    readonly: {
      type: Boolean,
      default: false
    },
    focus: {
      type: Function,
      default: () => {
      },
    },
    width: {
      type: String
    },
    icon: {
      type: String
    },
    onClick: {
      type: Function,
      default: () => {
      }
    },
    onEnter: {
      type: Function,
      default: () => {
      }
    }
  },
}
</script>
<style scoped>
input {
  outline: 0;
  height: 22px;
  line-height: 22px;
  border-radius: 0;
  outline: 0;
  border: 1px solid var(--input-border-color);
  padding-left: 5px;
  background: var(--input-background);
  color: var(--color);
  width: 100%;
}

input:focus {
  border-color: var(--input-border-foucs-color);
}

div {
  position: relative;
  display: inline-block;
}

span {
  position: absolute;
  right: 5px;
  color: var(--icon-color);
  cursor: pointer;
}

</style>