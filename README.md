# BrowserStorage 浏览器本地存储

## 产生背景
从html5开始，浏览器本地存储能力已经变的很强大了，但是每一种存储的api都不相同，BrowserStorage将本地存储封装成同一api，极大的方便了使用。

## 快速开始

浏览器引用
```html
   <script src="browserStorage.js"></script>
```
npm安装
```bash
npm install browsers-storage --save
```
### 默认使用
不指定存储方式时，优先使用websql,如果浏览器不支持websql，则降级使用indexdb
```javascript
  //目前只有chrome支持websql,其它浏览器都不支持websql
  let storage = new BrowserStorage();
```

### 指定存储
```javascript
  //indexdb
  let indexdb = new BrowserStorage('indexdb');

  //localStorage
  let local = new BrowserStorage('local');

  //sessionStorage
  let session = new BrowserStorage('session');

  //内存
  let memory = new BrowserStorage('memory');

  //websql
  let websql = new BrowserStorage('websql');
```

### 对数据进行操作
```javascript
  //添加数据
  for(var i =0 ; i < 10 ; i++ ){
    storage.put("storage_"+i,"testcase " + i)
  }
  
  //获取数据
  storage.get("storage_0").then(function(res){
    console.log(res);
  })
  
  //删除数据
  storage.del("storage_9").then(function(res){
    console.log(res);
  })
  
  //存储大小
  storage.size().then(function(res){
    console.log(res);
  })
  
  //获取包含关键字key
  storage.keys("storage").then(function(res){
    console.log(res);
  })
```

## 示例
### 在线示例
[查看](http://browserstorage.demos.party/test/test.html)

### 本地查看
```bash
  git clone https://github.com/doubi-NO1/browserStorage.git
  
  cd browswerStorage

  node server.js
```
打开浏览器输入地址 [http://localhost:9090/test/test.html](http://localhost:9090/test/test.html)查看效果

注意：BrowserStorage全部api均为异步Promise方式
### 协议
MIT