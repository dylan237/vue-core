class Observer {
  constructor (data) {
    this.observer(data)
  }
  observer(data) {
    if (data && typeof data === 'object') {
      Object.keys(data).forEach(key => {
        this.defineReactive(data, key, data[key])
      })
    }
  }
  defineReactive(obj, key, value) {
    this.observer(value) // 遞迴劫持值為物件的情況

    Object.defineProperty(obj, key, {
      configurable: false,
      enumerable: true,
      get() {
        return value
      },
      set: (newValue) => {
        his.observer(newValue) // 賦值時也要重新劫持
        if (newValue !== value) {
          value = newValue
        }
      }
    })
  }
}