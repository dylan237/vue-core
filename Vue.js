class Vue {
  constructor(options) {
    const root = typeof options.el === 'string' ? document.querySelector(options.el) : options.el
    if (root) {
      this.$el = root
      this.$data = options.data
      this.$options = options
      // 數據劫持
      new Observer(this.$data)
      // 模板語法編譯器
      // new Compiler(this.$el)
    }
  }
}