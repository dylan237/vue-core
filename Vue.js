/* 封裝模板語 syntax 策略 */
const compileStrategies = {
  text(node, expr, vm) {
    const value = compileUtil.getValue(expr, vm)
    updater.text(node, value)
  },
  html(node, expr, vm) {
    const value = compileUtil.getValue(expr, vm)
    updater.html(node, value)
  },
  model(node, expr, vm) {
    const value = compileUtil.getValue(expr, vm)
    updater.model(node, value)
    node.addEventListener('input', (e) => {
      const newValue = e.target.value;
      compileUtil.setVal(expr, vm, newValue)
    })
  },
  on(node, expr, vm, event) {
    const cb = compileUtil.getValue(expr, vm)
    if (typeof cb !== 'function') return
    node.addEventListener(event, cb, false)
  },
  bind() {}
}

const updater = {
  text(node, value) {
    node.textContent = value
  },
  html(node, html) {
    node.innerHTML = html
  },
  model(node, value) {
    node.value = value
  },
}

const compileUtil = {
  compileStrategies: Object.keys(compileStrategies),
  isDirective (attr) {
    const list = ['v-']
    return list.some(directive => attr.includes(directive))
  },
  isEventAlias (attr) {
    const list = ['@']
    return list.some(directive => attr.includes(directive))
  },
  isElementNode(node) {
    return node.nodeType === 1
  },
  getStrategyKey(attr) {
    return attr?.replace('v-', '') || ''
  },
  /* 取得巢狀數據值 */
  getValue(expr, vm) {
    return expr.split('.').reduce((acc, cur) => acc[cur], vm.$data)
  },
  /* 寫入數據 */
  setVal(expr, vm, inputVal) {
    return expr.split('.').reduce((acc, cur, idx) => {
      if (idx === expr.split('.').length - 1) {
        return acc[cur] = inputVal;
      }
      return acc[cur];
    }, vm.$data)
  }
}

class Compiler {
  constructor(el, vm) {
    this.el = compileUtil.isElementNode(el) ? el : document.querySelector(el)
    this.vm = vm
    const fragment = this.node2Fragment(el)
    this.compile(fragment)
    el.appendChild(fragment)
  }
  compile(root) {
    const childNodes = root.childNodes
    Array.from(childNodes).forEach(child => {
      if (compileUtil.isElementNode(child)) {
        // 元素內若還有子元素則執行遞迴編譯
        child.childNodes && child.childNodes?.length && this.compile(child)
        this.compileElementNode(child)
      } else {
        this.compileMustacheNode(child)
      }
    })
  }
  /* 編譯文本 */
  compileMustacheNode(node) {
    const nodeContent = node.textContent.trim()
    // console.log('compileMustacheNode---', nodeContent)
  }
  /* 編譯 dom */
  compileElementNode(node) {
    const attrs = { ...node.attributes } // 取 child node 的 attributes
    for (const key of Object.keys(attrs)) {
      const { name, value } = attrs[key] // v-on:click="data.text" -> v-on:click & data.text
      const [directive, event] = name.split(':') // v-on:click -> ['v-on', 'click']
      // 處理 v-
      if (compileUtil.isDirective(directive)) {
        const strategy = compileUtil.getStrategyKey(directive)
        if (compileUtil.compileStrategies.includes(strategy)) {
          compileStrategies[strategy](node, value, this.vm, event)
        }
      }
      // 處理 @event 
      else if (compileUtil.isEventAlias(name)) {
        const [, eventName] = name.split('@')
        compileStrategies['on'](node, value, this.vm, eventName)
      }
      // 刪除模板 syntax
      node.removeAttribute(name)
    }
  }
  /* 將模板語法轉儲存至 fragment, 提升效能 */
  node2Fragment(el) {
    const fragment = document.createDocumentFragment()
    const childNodes = el.childNodes
    Array.from(childNodes).forEach(child => fragment.appendChild(child))
    return fragment
  }
}

class Vue {
  constructor(options) {
    if (options.el) {
      this.$el = compileUtil.isElementNode(options.el) 
        ? options.el
        : document.querySelector(options.el)
      this.$data = options.data
      this.$options = options
      // 數據劫持
      new Observer(this.$data)
      // 模板語法編譯器
      new Compiler(this.$el, this)
    }
  }
}