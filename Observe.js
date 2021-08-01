class Observer {
  constructor (data) {
    this.observe(data)
  }
  observe(data) {
    if (data && typeof data === 'object') {
      Object.keys(data).forEach(key => {
        this.defineReactive(data, key, data[key])
      })
    }
  }
  defineReactive(obj, key, value) {
    this.observe(value) // 遞迴劫持值為物件的情況

    Object.defineProperty(obj, key, {
      configurable: false,
      enumerable: true,
      get() {
        return value
      },
      set: (newValue) => {
        this.observe(newValue) // 賦值時重新劫持
        if (newValue !== value) {
          value = newValue
        }
      }
    })
  }
}