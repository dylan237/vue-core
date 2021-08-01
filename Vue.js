const compileUtil = {
  html (node, expr, vm) {

  },
  isDirective (attr) {
    return attr.includes('v-')
  },
  isElementNode(node) {
    return node.nodeType === 1
  }
}

class Compiler {
  constructor(el, vm) {
    this.el = compileUtil.isElementNode(el) ? el : document.querySelector(el)
    this.vm = vm
    const fragment = this.node2Fragment(el)
    this.compile(fragment)
  }
  compile(fragment) {
    const childNodes = fragment.childNodes
    Array.from(childNodes).forEach(child => {
      if (compileUtil.isElementNode(child)) {
        this.compileElementNode(child)
      } else {
        this.compileMustacheNode(child)
      }
    })
  }
  /* 編譯文本 */
  compileMustacheNode(node) {
    const nodeContent = node.textContent.trim()
    // text = text.value.trim()
    console.log('nodeContent---', nodeContent)
  }
  /* 編譯 dom */
  compileElementNode(node) {
    const attrs = { ...node.attributes } // 取 child node 的 attributes
    for (const key of Object.keys(attrs)) {
      const { 
        name: directive,
        value
      } = attrs[key]
      // 是 「 v- 」 才處理
      if (compileUtil.isDirective(directive)) {
        console.log('directive---',directive)
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