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
      compileUtil.setValue(expr, vm, newValue)
    })
  },
  on(node, expr, vm, event) {
    const cb = vm.$options?.methods[expr]
    if (typeof cb !== 'function') return
    const [evtName, behavior] = event.split('.')
    node.addEventListener(evtName, cb.bind(vm), behavior === 'capture')
  },
  bind(node, expr, vm, attr) {
    const value = compileUtil.getValue(expr, vm)
    updater.bind(node, value, attr)
  }
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
  bind(node, value, attr) {
    node.setAttribute(attr, value)
  }
}

const compileUtil = {
  strategies: Object.keys(compileStrategies),
  isDirective(attr) {
    const list = ['v-']
    return list.some(directive => attr.includes(directive))
  },
  isEventAlias(attr) {
    const list = ['@']
    return list.some(directive => attr.includes(directive))
  },
  isBindAlias(attr) {
    return attr.startsWith(':')
  },
  /* 判斷是否為 dom */
  isElementNode(node) {
    return node.nodeType === 1
  },
  /* v-text -> text */
  getStrategyKey(attr) {
    return attr?.replace('v-', '') || ''
  },
  /* 取得巢狀數據對應值 */
  getValue(expr, vm) {
    return expr.split('.').reduce((acc, cur) => acc[cur], vm.$data)
  },
  /* 將值寫入巢狀資料 */
  setValue(expr, vm, inputVal) {
    const exprArr = expr.split('.')
    return exprArr.reduce((acc, cur, idx) => {
      if (idx === exprArr.length - 1) {
        return acc[cur] = inputVal;
      }
      return acc[cur];
    }, vm.$data)
  },
  /* 取得 {{  }} 內資料 */
  getMustacheValue(expr, vm) {
    const REGEXP = /\{\{(.+?)\}\}/g
    return expr.replace(REGEXP, (...args) => {
      const content = args[1].trim()
      return compileUtil.getValue(content, vm)
    })
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
        this.compileElementNode(child)
      } else {
        this.compileMustacheNode(child)
      }
      // 元素內若還有子元素則執行遞迴編譯
      child.childNodes?.length && this.compile(child)
    })
  }
  /* 編譯 {{ }} 文本 */
  compileMustacheNode(node) {
    const nodeContent = node.textContent.trim()
    const value = compileUtil.getMustacheValue(nodeContent, this.vm)
    updater.text(node, value)
  }
  /* 編譯 dom */
  compileElementNode(node) {
    const attrs = { ...node.attributes } // 取 child node 的 attributes
    for (const key of Object.keys(attrs)) {
      const { name, value } = attrs[key] // v-on:click="data.text" -> { name: 'v-on:click', value: 'data.text' }
      const [directive, eventOrAttr] = name.split(':') // 1. v-on:click -> ['v-on', 'click']  2. :src="data" -> [undefined, 'src']
      // 處理 v-
      if (compileUtil.isDirective(directive)) {
        const strategy = compileUtil.getStrategyKey(directive)
        if (compileUtil.strategies.includes(strategy)) {
          compileStrategies[strategy](node, value, this.vm, eventOrAttr)
        }
      }
      // 事件綁定 alias 處理, 如 @click 
      else if (compileUtil.isEventAlias(name)) {
        const [, eventName] = name.split('@')
        compileStrategies['on'](node, value, this.vm, eventName)
      }
      // v-bind alias 處理, 如 :src="data"
      else if (compileUtil.isBindAlias(name)) {
        compileStrategies['bind'](node, value, this.vm, eventOrAttr)
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
      // 資料劫持
      new Observer(this.$data)
      // 模板語法編譯器
      new Compiler(this.$el, this)
    }
  }
}