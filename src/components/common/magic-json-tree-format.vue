<template>
  <div v-if="item.level > 0">
    <span v-for="index in item.level - 1" :key="index">
      <img :src="imgLine" v-if="indentLevel[index] != 1"/>
      <img :src="imgIndent" style="width: 16px;height: 16px;" v-else/>
    </span>
    <img :src="index + 1 == dataLength ? imgEnd : img"/>
  </div>
</template>

<script>
import imgEnd from '../../assets/images/elbow-end.gif'
import imgLine from '../../assets/images/elbow-line.gif'
import img from '../../assets/images/elbow.gif'
import imgIndent from '../../assets/images/s.gif'

  export default {
    name: 'MagicJsonTreeFormat',
    props: {
      item: {
        type: Object,
        required: true
      },
      index: Number,
      dataLength: Number,
      indentLevel: Array
    },
    data() {
      return {
        imgEnd,
        imgLine,
        img,
        imgIndent
      }
    },
  }
</script>
<style>
</style>
