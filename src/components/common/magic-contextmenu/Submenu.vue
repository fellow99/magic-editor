<template>
  <div
      v-if="visible"
      ref="menu"
      :class="[commonClass.menu, 'magic-contextmenu', customClass]"
      :style="{left: style.left + 'px', top: style.top + 'px', minWidth: style.minWidth + 'px', zIndex: style.zIndex}"
      @contextmenu="(e)=>e.preventDefault()"
  >
    <div class="magic-contextmenu-body">
      <template v-for="(item,index) of menus">
        <template v-if="!item.hidden">
          <div
              v-if="item.disabled"
              :key="'d' + index"
              :class="[
                commonClass.menuItem, commonClass.unclickableMenuItem,
                'magic-contextmenu-item', 'magic-contextmenu-item-disabled',
                item.divided?'magic-contextmenu-divided':null
              ]"
          >
            <div v-if="hasIcon" class="magic-contextmenu-item-icon">
              <i v-if="item.icon" :class="'ma-icon ' + item.icon"></i>
            </div>
            <span class="magic-contextmenu-item-label">{{ item.label }}</span>
            <div class="magic-contextmenu-item-expand-icon"></div>
          </div>
          <div
              v-else-if="item.children"
              :key="'c' + index"
              :class="[
                commonClass.menuItem, commonClass.unclickableMenuItem,
                'magic-contextmenu-item', 'magic-contextmenu-item-available',
                activeSubmenu.index===index? 'magic-contextmenu-item-expand':null,
                item.divided?'magic-contextmenu-item-divided':null
              ]"
              @mouseenter="($event)=>enterItem($event,item,index)"
          >
            <div v-if="hasIcon" class="magic-contextmenu-item-icon">
              <i v-if="item.icon" :class="'ma-icon ' + item.icon"></i>
            </div>
            <span class="magic-contextmenu-item-label">{{ item.label }}</span>
            <div class="magic-contextmenu-item-expand-icon">▶</div>
          </div>
          <div
              v-else
              :key="'n' + index"
              :class="[
                commonClass.menuItem, commonClass.clickableMenuItem,
                'magic-contextmenu-item', 'magic-contextmenu-item-available',
                item.divided?'magic-contextmenu-item-divided':null
              ]"
              @click="itemClick(item)"
              @mouseenter="($event)=>enterItem($event,item,index)"
          >
            <div v-if="hasIcon" class="magic-contextmenu-item-icon">
              <i v-if="item.icon" :class="'ma-icon ' + item.icon"></i>
            </div>
            <span class="magic-contextmenu-item-label">{{ item.label }}</span>
            <div class="magic-contextmenu-item-expand-icon"></div>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

<script>
import { createApp } from "vue"
import {
  COMPONENT_NAME,
  SUBMENU_OPEN_TREND_LEFT,
  SUBMENU_OPEN_TREND_RIGHT,
  SUBMENU_X_OFFSET,
  SUBMENU_Y_OFFSET
} from "./constant.js"

export default {
  name: COMPONENT_NAME,
  props: {
    commonClass: { type: Object, default: () => ({ menu: null, menuItem: null, clickableMenuItem: null, unclickableMenuItem: null }) },
    menus: { type: Array, default: () => [] },
    position: { type: Object, default: () => ({ x: 0, y: 0, width: 0, height: 0 }) },
    style: { type: Object, default: () => ({ left: 0, top: 0, zIndex: 2, minWidth: 150 }) },
    customClass: { type: String, default: null },
    openTrend: { type: String, default: SUBMENU_OPEN_TREND_RIGHT }
  },
  data() {
    return {
      activeSubmenu: {
        index: null,
        instance: null,
        app: null
      },
      visible: false,
      hasIcon: false,
      localOpenTrend: this.openTrend
    }
  },
  mounted() {
    this.visible = true
    for (let item of this.menus) {
      if (item.icon) {
        this.hasIcon = true
        break
      }
    }
    this.$nextTick(() => {
      const windowWidth = document.documentElement.clientWidth
      const windowHeight = document.documentElement.clientHeight
      const menu = this.$refs.menu
      const menuWidth = menu.offsetWidth
      const menuHeight = menu.offsetHeight

      (this.localOpenTrend === SUBMENU_OPEN_TREND_LEFT
          ? this.leftOpen
          : this.rightOpen)(windowWidth, windowHeight, menuWidth)

      this.style.top = this.position.y
      if (this.position.y + menuHeight > windowHeight) {
        if (this.position.height === 0) {
          this.style.top = this.position.y - menuHeight
        } else {
          this.style.top = windowHeight - menuHeight
        }
      }
    })
  },
  methods: {
    leftOpen(windowWidth, windowHeight, menuWidth) {
      this.style.left = this.position.x - menuWidth
      this.localOpenTrend = SUBMENU_OPEN_TREND_LEFT
      if (this.style.left < 0) {
        this.localOpenTrend = SUBMENU_OPEN_TREND_RIGHT
        if (this.position.width === 0) {
          this.style.left = 0
        } else {
          this.style.left = this.position.x + this.position.width
        }
      }
    },
    rightOpen(windowWidth, windowHeight, menuWidth) {
      this.style.left = this.position.x + this.position.width
      this.localOpenTrend = SUBMENU_OPEN_TREND_RIGHT
      if (this.style.left + menuWidth > windowWidth) {
        this.localOpenTrend = SUBMENU_OPEN_TREND_LEFT
        if (this.position.width === 0) {
          this.style.left = windowWidth - menuWidth
        } else {
          this.style.left = this.position.x - menuWidth
        }
      }
    },
    enterItem(e, item, index) {
      if (!this.visible) {
        return
      }
      if (this.activeSubmenu.instance) {
        if (this.activeSubmenu.index === index) {
          return
        } else {
          this.closeActiveSubmenu()
        }
      }
      if (!item.children) {
        return
      }
      const menuItemClientRect = e.target.getBoundingClientRect()
      const container = document.createElement('div')
      document.body.appendChild(container)

      const submenuStyle = { ...this.style }
      const submenuPosition = {
        x: menuItemClientRect.x + SUBMENU_X_OFFSET,
        y: menuItemClientRect.y + SUBMENU_Y_OFFSET,
        width: menuItemClientRect.width - 2 * SUBMENU_X_OFFSET,
        height: menuItemClientRect.width
      }

      this.activeSubmenu.index = index
      const app = createApp({
        extends: this.$options,
        propsData: {
          menus: item.children,
          openTrend: this.localOpenTrend,
          commonClass: this.commonClass,
          position: submenuPosition,
          style: submenuStyle,
          minWidth: typeof item.minWidth === "number" ? item.minWidth : this.style.minWidth,
          zIndex: this.style.zIndex,
          customClass: typeof item.customClass === "string" ? item.customClass : this.customClass
        }
      })
      app.component('Submenu', this.$options)

      this.activeSubmenu.app = app
      this.activeSubmenu.instance = app.mount(container)
    },
    closeActiveSubmenu() {
      if (this.activeSubmenu.instance && this.activeSubmenu.instance.close) {
        this.activeSubmenu.instance.close()
      }
      if (this.activeSubmenu.app) {
        this.activeSubmenu.app.unmount()
      }
      this.activeSubmenu.instance = null
      this.activeSubmenu.app = null
      this.activeSubmenu.index = null
    },
    itemClick(item) {
      if (!this.visible) {
        return
      }
      if (
          item &&
          !item.disabled &&
          !item.hidden &&
          typeof item.onClick === "function"
      ) {
        return item.onClick()
      }
    },
    close() {
      this.visible = false
      this.closeActiveSubmenu()
      this.$nextTick(() => {
        this.$emit('close')
      })
    }
  }
}
</script>

<style>
.magic-contextmenu {
  position: fixed;
  border: 1px solid var(--border-color);
  background: var(--background);
}

.magic-contextmenu-body {
  display: block;
}

.magic-contextmenu-item {
  transition: 0.2s;
  height: 24px;
  line-height: 24px;
  padding: 0 10px;
  display: flex;
}

.magic-contextmenu-item-divided {
  border-bottom: 1px solid var(--border-color);
}

.magic-contextmenu-item .magic-contextmenu-item-icon {
  margin-right: 5px;
  width: 13px;
}
.magic-contextmenu-item .magic-contextmenu-item-icon i{
    font-size: 12px;
    color: var(--icon-color);
}

.magic-contextmenu-item .magic-contextmenu-item-label {
  flex: 1;
}

.magic-contextmenu-item .magic-contextmenu-item-expand-icon {
  margin-left: 10px;
  font-size: 6px;
  width: 10px;
}

.magic-contextmenu-item-available {
  color: var(--color);
  cursor: pointer;
}

.magic-contextmenu-item-available:hover {
  background: var(--select-option-hover-background);
  color: var(--select-option-hover-color);
}

.magic-contextmenu-item-disabled {
  color: var(--select-option-disabled-color);
  cursor: not-allowed;
}

.magic-contextmenu-item-expand {
  background: var(--select-option-hover-background);
  color: var(--select-option-hover-color);
}
</style>
