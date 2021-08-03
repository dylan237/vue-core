
/* 每個 $data 內部屬性都是都會對應一個 watcher */
class Watcher {
  constructor (expr, vm, viewUpdateCallback) {
    this.expr = expr // 儲存資料位置，可能是 'someData.foo'，訪問資料時使用 getValue 函數傳進 expr 找到對應的值 ( vm.$data.someData.foo )
    this.vm = vm
    this.viewUpdateCallback = viewUpdateCallback
    this.oldValue = this.getOldValue(expr, vm) // 2. 初始化 watcher 時就會觸發這個函數
  }
  getOldValue(expr, vm) {
    Dependency.target = this // 3. 將 this(watcher instance) 作為靜態屬性暫存在 Dependency.target 中
    const oldValue = compileUtil.getValue(expr, vm) // 4. 這裡執行結束後，隨即觸發 observer 內 defineProperty API 中的 get() 函數。因為 vm.$data 內所有的資料都被Object.defineProperty 劫持了，只要針對內部資料"進行訪問"都會觸發get)
    Dependency.target = null // 6. watcher 已經在 dep 中，此時便可以清空暫存，到此已完成訂閱，接著則是被動等著被監聽的值被改變 (observer 中的 set()函數)
    return oldValue
  }
  update() {
    const newValue = compileUtil.getValue(this.expr, this.vm)
    if (this.oldValue !== newValue) {
      this.watch(newValue)
      this.oldValue = newValue
      this.vm.$options.beforeUpdate.call(this.vm)
      this.viewUpdateCallback(newValue)
      this.vm.$options.updated.call(this.vm)
    }
  }
  /* watch API */
  watch(newValue) {
    const callback = this.vm.$options?.watch?.[this.expr]
    if (callback && typeof callback === 'function') {
      callback.call(this.vm, newValue, this.oldValue)
    }
  }
}

/* 依賴收集器, 儲存 watcher */
class Dependency {
  constructor () {
    this.subscribes = []
  }
  add(watcher) {
    this.subscribes.push(watcher)
  }
  notify() {
    this.subscribes.forEach(watcher => watcher.update())
  }
}
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

    const dep = new Dependency() // 每個資料都會掛載一個對應的 dep 來存放它的 watcher 實例

    Object.defineProperty(obj, key, {
      configurable: false,
      enumerable: true,
      get() {
        Dependency.target && dep.add(Dependency.target) // 5. 由於第三步驟時儲存了 watcher 的實例在 Dependency.target，到這裏自然會將該 watcher 存進 Dependency 陣列里
        return value
      },
      set: (newValue) => {
        this.observe(newValue) // 賦值時重新劫持
        if (newValue !== value) {
          value = newValue
          dep.notify() // 7. 未來當資料產生改變時透過 Dependency 的 notify 方法通知被儲存在 dep 中的 watcher,  watcher 則呼叫自己的 update 函數，update 函數則觸發第一步綁定的更新畫面callback
        }
      }
    })
  }
}