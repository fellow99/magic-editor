<template>
  <div></div>
</template>

<script>
import { createApp } from "vue"
import {getElementsByClassName, getMountTarget} from "./util.js"
import Submenu from "./Submenu.vue"

export default {
  props: {
    menus: { type: Array, default: () => [] },
    position: { type: Object, default: () => ({ x: 0, y: 0 }) },
    customClass: { type: String, default: null },
    minWidth: { type: Number, default: 150 },
    zIndex: { type: Number, default: 2 },
    destroy: { type: Function, default: null }
  },
  data() {
    return {
      style: {
        zIndex: 2,
        minWidth: 150
      },
      mainMenuInstance: null,
      mainMenuApp: null,
      mouseListening: false,
      commonClass: {}
    }
  },
  mounted() {
    this.commonClass = {
      menu: this.$style.menu,
      menuItem: this.$style.menu_item,
      clickableMenuItem: this.$style.menu_item__clickable,
      unclickableMenuItem: this.$style.menu_item__unclickable
    }
    this.style.minWidth = this.minWidth
    this.style.zIndex = this.zIndex

    const container = document.createElement('div')
    getMountTarget().appendChild(container)

    const app = createApp(Submenu, {
      menus: this.menus,
      position: {
        x: this.position.x,
        y: this.position.y,
        width: 0,
        height: 0
      },
      style: { ...this.style },
      customClass: this.customClass,
      commonClass: { ...this.commonClass }
    })
    app.component('Submenu', Submenu)

    this.mainMenuApp = app
    this.mainMenuInstance = app.mount(container)
    this.addListener()
  },
  unmounted() {
    this.removeListener()
    if (this.mainMenuInstance && this.mainMenuInstance.close) {
      this.mainMenuInstance.close()
    }
    if (this.mainMenuApp) {
      this.mainMenuApp.unmount()
    }
    if (typeof this.destroy == 'function') {
      this.destroy()
    }
  },
  methods: {
    mousewheelListener() {
      this.unmountSelf()
    },
    mouseDownListener(e) {
      let el = e.target
      const menus = getElementsByClassName(this.$style.menu)
      while (!menus.find(m => m === el) && el.parentElement) {
        el = el.parentElement
      }
      if (!menus.find(m => m === el)) {
        this.unmountSelf()
      }
    },
    mouseClickListener(e) {
      let el = e.target
      const menus = getElementsByClassName(this.$style.menu)
      const menuItems = getElementsByClassName(this.$style.menu_item)
      const unclickableMenuItems = getElementsByClassName(
          this.$style.menu_item__unclickable
      )
      while (
          !menus.find(m => m === el) &&
          !menuItems.find(m => m === el) &&
          el.parentElement
          ) {
        el = el.parentElement
      }
      if (menuItems.find(m => m === el)) {
        if (e.button !== 0 || unclickableMenuItems.find(m => m === el)) {
          return
        }
        this.unmountSelf()
        return
      }
      if (!menus.find(m => m === el)) {
        this.unmountSelf()
      }
    },
    unmountSelf() {
      if (this.mainMenuInstance && this.mainMenuInstance.close) {
        this.mainMenuInstance.close()
      }
      if (this.mainMenuApp) {
        this.mainMenuApp.unmount()
        this.mainMenuApp = null
        this.mainMenuInstance = null
      }
      this.removeListener()
      if (typeof this.destroy == 'function') {
        this.destroy()
      }
    },
    addListener() {
      if (!this.mouseListening) {
        document.addEventListener("click", this.mouseClickListener)
        document.addEventListener("mousedown", this.mouseDownListener)
        document.addEventListener("mousewheel", this.mousewheelListener)
        this.mouseListening = true
      }
    },
    removeListener() {
      if (this.mouseListening) {
        document.removeEventListener("click", this.mouseClickListener)
        document.removeEventListener("mousedown", this.mouseDownListener)
        document.removeEventListener("mousewheel", this.mousewheelListener)
        this.mouseListening = false
      }
    }
  }
}
</script>

<style module>
.menu,
.menu_item,
.menu_item__clickable,
.menu_item__unclickable {
  box-sizing: border-box
}
</style>
