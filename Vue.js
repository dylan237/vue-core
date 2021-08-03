/* 封裝模板語 syntax 策略 */
const compileStrategies = {
  text(node, expr, vm) {
    const value = compileUtil.getValue(expr, vm)
    updater.text(node, value)
    // 1. 創建訂閱者 (watcher)，綁定資料對應的更新畫面callback (後續流程至 watcher 查看)
    new Watcher(expr, vm, (newValue) => {
      updater.text(node, newValue)
    })
  },
  html(node, expr, vm) {
    const value = compileUtil.getValue(expr, vm)
    updater.html(node, value)
    new Watcher(expr, vm, (newValue) => {
      updater.html(node, newValue)
    })
  },
  model(node, expr, vm) {
    const value = compileUtil.getValue(expr, vm)
    updater.model(node, value)
    node.addEventListener('input', (e) => {
      const newValue = e.target.value;
      compileUtil.setValue(expr, vm, newValue)
    })
    new Watcher(expr, vm, (newValue) => {
      updater.model(node, newValue)
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
    new Watcher(expr, vm, (newValue) => {
      updater.bind(node, newValue)
    })
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
  isMustacheSyntax(node) {
    return node?.textContent?.includes('{{')
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
  /* 取得 {{  }} 內字串 */
  getMustacheExpr(mustache) {
    const REGEXP = /\{\{(.+?)\}\}/g
    return mustache.replace(REGEXP, (...args) => {
      const expr = args[1].trim()
      return expr
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
      /* 編譯 dom */
      if (compileUtil.isElementNode(child)) {
        // console.log('node child---',child);
        this.compileElementNode(child)
      } 
      /* 編譯 {{ }} */
      else if (compileUtil.isMustacheSyntax(child)) {
        // console.log('text child---',child);
        this.compileMustacheNode(child)
      }
      // 元素內若還有子元素則執行遞迴編譯
      child.childNodes?.length && this.compile(child)
    })
  }
  /* 編譯 {{ }} 文本 */
  compileMustacheNode(node) {
    const mustache = node.textContent.trim()
    const expr = compileUtil.getMustacheExpr(mustache)
    compileStrategies['text'](node, expr, this.vm)
  }
  /* 編譯 dom */
  compileElementNode(node) {
    const attrs = { ...node.attributes } // 取 child node 的 attributes
    for (const key of Object.keys(attrs)) {
      const { name, value } = attrs[key] // v-on:click="data.text" -> { name: 'v-on:click', value: 'data.text' }
      const [directive, eventOrAttr] = name.split(':') // 1. v-on:click -> ['v-on', 'click']  2. :src -> [undefined, 'src']
      // 處理 v-
      if (compileUtil.isDirective(directive)) {
        const strategy = compileUtil.getStrategyKey(directive)
        if (compileUtil.strategies.includes(strategy)) {
          compileStrategies[strategy](node, value, this.vm, eventOrAttr)
        }
        // 刪除模板 syntax
        node.removeAttribute(name)
      }
      // 事件綁定 alias 處理, 如 @click 
      else if (compileUtil.isEventAlias(name)) {
        const [, eventName] = name.split('@')
        compileStrategies['on'](node, value, this.vm, eventName)
        // 刪除模板 syntax
        node.removeAttribute(name)
      }
      // v-bind alias 處理, 如 :src
      else if (compileUtil.isBindAlias(name)) {
        compileStrategies['bind'](node, value, this.vm, eventOrAttr)
        // 刪除模板 syntax
        node.removeAttribute(name)
      }
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
      options.beforeCreate.call(this)
      this.$data = options.data
      this.$options = options
      // 資料劫持
      new Observer(this.$data, this)
      // 代理模式，將 vm.$data 內所有資料代理至 vm 物件第一層
      // 可使用簡短的 vm.somData 代替 vm.$data.someData 來訪問值。
      this.dataProxy(this.$data)
      options.created.call(this)
      this.$el = compileUtil.isElementNode(options.el) 
        ? options.el
        : document.querySelector(options.el)
      options.beforeMount.call(this)
      // 模板語法編譯器
      new Compiler(this.$el, this)
      options.mounted.call(this)
    }
  }
  dataProxy(data) {
    Object.keys(data).forEach(key => {
      Object.defineProperty(this, key, {
        configurable: false,
        enumerable: true,
        get() {
          return data[key]
        },
        set(newValue) {
          data[key] = newValue
        }
      })
    })
  }
}