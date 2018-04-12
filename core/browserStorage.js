/**
 * 参考资料
 * https://w3c.github.io/IndexedDB/
 * http://aaronpowell.github.io/db.js/
 * https://github.com/mozilla/localForage/blob/master/src/drivers/indexeddb.js
 * https://github.com/WebReflection/db/blob/master/src/IndexedDB.js
 * https://github.com/aaronpowell/db.js/blob/master/src/db.js
 */

(function (window, undefined) {
  var supportWebsql = !!openDatabase,
    indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.OIndexedDB || window.msIndexedDB,
    DBNAME = 'Stroage.Indexdb',
    DBVERSION = 1,
    STORENAME = 'keyvaluepairs',
    db,
    websql;

  /**
   * 使用murmurhash2_32 hash算法模拟CRC32值
   * @param  {[type]} str  [description]
   * @return {[type]}      [description]
   */
  function crc32(str) {
    var
      l = str.length,
      h = 0x9747b28c ^ l,
      i = 0,
      k;

    while (l >= 4) {
      k =
        ((str.charCodeAt(i) & 0xff)) |
        ((str.charCodeAt(++i) & 0xff) << 8) |
        ((str.charCodeAt(++i) & 0xff) << 16) |
        ((str.charCodeAt(++i) & 0xff) << 24);

      k = (((k & 0xffff) * 0x5bd1e995) + ((((k >>> 16) * 0x5bd1e995) & 0xffff) << 16));
      k ^= k >>> 24;
      k = (((k & 0xffff) * 0x5bd1e995) + ((((k >>> 16) * 0x5bd1e995) & 0xffff) << 16));

      h = (((h & 0xffff) * 0x5bd1e995) + ((((h >>> 16) * 0x5bd1e995) & 0xffff) << 16)) ^ k;

      l -= 4;
      ++i;
    }

    switch (l) {
      case 3:
        h ^= (str.charCodeAt(i + 2) & 0xff) << 16;
      case 2:
        h ^= (str.charCodeAt(i + 1) & 0xff) << 8;
      case 1:
        h ^= (str.charCodeAt(i) & 0xff);
        h = (((h & 0xffff) * 0x5bd1e995) + ((((h >>> 16) * 0x5bd1e995) & 0xffff) << 16));
    }

    h ^= h >>> 13;
    h = (((h & 0xffff) * 0x5bd1e995) + ((((h >>> 16) * 0x5bd1e995) & 0xffff) << 16));
    h ^= h >>> 15;

    return (h >>> 0).toString(36);
  }

  function openWebsql() {
    //exec("delete from keyvaluepairs" )
    //exec("drop table keyvaluepairs" ,[],function(t,result){console.dir(result)},function(e){console.dir(e)})
    websql = openDatabase(DBNAME, String(DBVERSION), DBNAME, 1024 * 1024 * 50);
    exec(' CREATE TABLE IF NOT EXISTS ' + STORENAME +
      ' (id INTEGER PRIMARY KEY, unk unique, gp , key , value,type INTEGER,version); ', []);
  }

  function WebsqlDriver(name) {
    this.driver = 'WebsqlDriver';
    this.name = name || 'def';
    if (!websql) {
      openWebsql();
    }
  }

  function exec(sql, parm, callback) {
    return new Promise((resolve,reject)=> {
      websql.transaction(function (t) {
        t.executeSql(sql, parm,
          function (t, results) {
            resolve(callback ? callback(results) : undefined);
          },
          function (t, error) {
            reject(error);
          });
      });
    });
  }

  if (supportWebsql) {
    WebsqlDriver.prototype = {
      /**
       * [function description]
       * @param  {[type]} key     [description]
       * @param  {[type]} value   [description]
       * @param  {String/INTEGER} version 乐观锁
       * @return {[type]}         [description]
       */
      put: function (key, value, version) {
        var v,
          type = typeof value === "string" ? 1 : 0;
        v = type === 1 ? value : JSON.stringify(
          value);
        return exec('REPLACE INTO ' +
          STORENAME +
          ' (unk,gp,key, value,type,version) VALUES (?, ?, ? , ?, ?, ?)', [crc32(this.name + key), this.name, key, v,
            type, version == undefined ? null : version
          ],
          function () {
            return [key, value];
          });
      },

      get: function (key) {
        return exec('SELECT value, type, version FROM ' + STORENAME +
          ' WHERE unk= ? LIMIT 1', [crc32(this.name + key)],
          function (results) {
            var res, item, rows = results.rows;
            if (rows.length) {
              item = rows.item(0);
              res = item.type === 1 ? item.value : JSON.parse(item.value);
              if (item.version) {
                res = [res, item.version];
              }
            }
            return res;
            /*
            return results.rows.length ?
              JSON.parse(results.rows.item(0).value) : null;
              */
          });
      },
      del: function (key) {
        return exec('DELETE FROM ' + STORENAME +
          ' WHERE unk = ?', [crc32(this.name + key)],
          function (results) {
            return key;
          });
      },
      size: function () {
        return exec('SELECT COUNT(id) as c FROM ' + STORENAME + ' WHERE gp=?', [this.name],
          function (results) {
            return results.rows.item(0).c;
          });
      },
      test: function (key) {
        return exec(' SELECT EXISTS( SELECT 1 FROM ' + STORENAME +
          ' WHERE unk= ? ) AS b', [crc32(this.name + key)],
          function (results) {
            return results.rows[0].b == 1;
          });
      },

      keys: function (prefix) {
        return exec('SELECT key FROM ' + STORENAME + ' WHERE gp=? ' + (prefix ? ' AND key like \'%' + prefix + '%\'' :
            ''), [
            this.name
          ],
          function (results) {
            var count = results.rows.length,
              buf = [];
            for (var i = 0; i < count; i++) {
              buf.push(results.rows.item(i).key);
            }
            return buf;
          });
      },
      clean: function (prefix) {
        return exec('DELETE FROM ' + STORENAME + ' WHERE gp=? ' + (prefix ? ' AND key like \'%' + prefix + '%\'' : ''), [
            this.name
          ],
          function (results) {
            return results.rowsAffected;
          });
      }
    };
  }


  /**
   * 使用indexDb存储
   */
  function IndexDriver(name) {
    this.driver = 'IndexDriver';
    this.name = crc32(name || 'def');
  }
  IndexDriver.prototype = {

    /**
     * 添加键值对.
     * 	var storage = new IndexDriver();
     * 	//添加字符串
     * 	storage.put("storage","testcase")
     * 	.then(function(res){
     * 		console.dir(res)
     * 	})
     * 	//添加对象
     *  storage.put("storage",{a:'a',b:'b',c:123}})
     *
     *
     * @param  {String} key   键
     * @param  {Object} value 值
     * @return {Promise}       promise对象
     */
    put: function (key, value, version) {
      var k = this.name + '.' + key,
        v = {
          value: value,
          type: typeof value === "string" ? 1 : 0,
          version: version
        };

      return withStore(
        'readwrite',
        function (store, promise) {
          //put方法覆盖已经存在值, add方法键已经存在抛出异常
          var req = store.put(v, k);
          req.onerror = withError(promise, req);
        },
        null,
        function () {
          return [key, value];
        }
      );
    },

    /**
     * 获取数据
     * var storage = new IndexDriver();
     * storage.get("storage").then(function(res){
     * 		console.dir(res)
     * 	})
     *
     * @param  {String}   key      键
     * @return {Promise}            promise对象
     */
    get: function (key) {
      var req, k = this.name + '.' + key;
      return withStore(
        'readonly',
        function (store, promise) {
          req = store.get(k);
          req.onerror = withError(promise, req);
        }, null,
        function () {
          var res = req.result;
          if (res) {
            if (res.version) res = [res.value, res.version];
            else res = res.value;
          }
          return res;
        });
    },

    /**
     * 删除数据
     * var storage = new IndexDriver();
     * storage.del("storage").then(function(res){
     * 		console.dir(res)
     * 	})
     * @param  {String} key 键
     * @return {Promise}     promise对象
     */
    del: function (key) {
      var k = this.name + '.' + key;
      return withStore('readwrite', function (store, promise) {
        var req = store.delete(k);
        req.onerror = withError(promise, req);
      }, null, function () {
        return key;
      });
    },

    /**
     * 获取总大小
     * 	var storage = new IndexDriver();
     * 	for(var i =0 ; i < 10 ; i++ ){
     * 		storage.put("storage_"+i,"testcase " + i)
     * 	}
     * 	storage.size().then(function(res){
     * 		console.dir(res)
     * 	})
     * @return {[type]}            [description]
     */
    size: function () {
      var res = 0,
        k = this.name + '.';
      return withStore(
        'readonly',
        null,
        function (cur) {
          if (cur && cur.key.indexOf(k) == 0) {
            res++;
          }
          return !!cur;
        },
        function () {
          return res;
        });
    },

    test: function (key) {
      var req, k = this.name + '.' + key;
      return withStore(
        'readonly',
        function (store, promise) {
          req = store.get(k);
          req.onerror = withError(promise, req);
        }, null,
        function () {
          return !!req.result;
        });
    },

    /**
     * 获取key
     * 	var storage = new IndexDriver();
     * 	for(var i =0 ; i < 10 ; i++ ){
     * 		storage.put("storage_"+i,"testcase " + i)
     * 	}
     *
     *  storage.keys("storage").then(function(res){
     * 		console.dir(res)
     * 	})
     * @param  {String} prefix 指定包含字符串
     * @return {Promise}        promise字符串
     */
    keys: function (prefix) {
      var req = [],
        k = this.name + '.';
      return withStore(
        'readonly',
        null,
        function (cur) {
          if (cur && cur.key.indexOf(k) == 0) {
            var v = cur.key;
            if (prefix) {
              if (v.indexOf(prefix) >= 0) req.push(v.substring(k.length, v.length));
            } else {
              req.push(v);
            }
          }
          return !!cur;
        },
        function () {
          return req;
        });
    },

    all: function (prefix) {
      var req = [],
        k = this.name + '.';
      return withStore(
        'readonly',
        null,
        function (cur) {
          if (cur && cur.key.indexOf(k) == 0) {
            var v = cur.key;
            if (prefix) {
              if (v.indexOf(prefix) >= 0) req.push(cur.value.value);
            } else {
              req.push(cur.value);
            }
          }
          return !!cur;
        },
        function () {
          return req;
        });
    },

    /**
     * 删除包含关键子的键值对
     *
     * @param  {String} prefix 关键字
     * @return {Promise}        promise对象
     */
    clean: function (prefix) {
      var req = [],
        self = this,
        size = 0,
        k = this.name + '.';
      return withStore(
        'readwrite',
        null,
        function (cur, store) {
          if (cur && cur.key.indexOf(k) == 0) {
            var v = cur.key;
            if (prefix) {
              if (v.indexOf(prefix) >= 0) {
                store.delete(v);
                size++;
              }
            } else {
              store.delete(v);
              size++;
            }
          }
          return !!cur;
        },
        function () {
          return size;
        });
    },

    /**
     * 清空存储库
     * @return {[type]} [description]
     */
    cls: function () {
      clearStore();
    }
  };

  function withDatabase(f) {
    if (db) {
      f();
    } else {
      var openreq = indexedDB.open(DBNAME, DBVERSION);
      openreq.onerror = function () {
        console.error('Indexdb打开失败', openreq.error.name);
      };

      //第一次打开
      openreq.onupgradeneeded = function () {
        var d = openreq.result;
        if (!d.objectStoreNames.contains(STORENAME)) {
          d.createObjectStore(STORENAME);
        }
      };

      //打开成功
      openreq.onsuccess = function () {
        db = openreq.result;
        f();
      };

    }
  }

  function withStore(type, callback, openCursor, oncomplete) {
    var promise = new Promise((resolve,reject)=> {
      withDatabase(function () {
        var transaction = db.transaction(STORENAME, type);
        transaction.oncomplete = function () {
          try {
            resolve(oncomplete());
          } catch (e) {
            console.dir(e);
          }
        };
        if (openCursor) {
          var store = transaction.objectStore(STORENAME),
            cur;
          cur = store.openCursor();
          cur.onsuccess = function () {
            var cursor = cur.result;
            if (openCursor(cursor, store)) {
              cursor.continue();
            }
          };
        } else {
          callback(transaction.objectStore(STORENAME), promise);
        }
      });
    });
    return promise;
  }

  function clearStore() {
    if (db) {
      var ts = db.transaction(STORENAME, 'readwrite'),
        store = ts.objectStore(STORENAME);
      store.clear();
    }
  }

  function withError(promise, req) {
    return function () {
      promise.reject(req.error);
      console.error('IndexDb操作失败', req.error.name);
    };
  }

  /**
   * 使用localStorage存储
   */
  function LocalDriver(st, name) {
    this.driver = 'LocalDriver';
    this.st = st;
    this.name = crc32(name || 'def');
  }

  function invoke(st, m, arg, callback) {
    return new Promise((resolve,reject)=> {
      resolve(callback(st[m].apply(st, arg)));
    });
  }
  LocalDriver.prototype = {

    /**
     * 添加数据
     * @param  {String} key   数据键值
     * @param  {Object} value 任意对象
     * @return {Void}
     */
    put: function (key, value, version) {
      var val = [value, version];
      return invoke(this.st, 'setItem', [this.name + '.' + key, JSON.stringify(val)],
        function () {
          return [key, value];
        });
    },


    /**
     * 获取数据
     * @param  {String} key 数据键
     * @return {Object}     key对应数据
     */
    get: function (key) {
      return invoke(this.st, 'getItem', [this.name + '.' + key],
        function (value) {
          var val = JSON.parse(value);
          return val ? (val[1] ? val : val[0]) : undefined;
        });
    },

    /**
     * 删除key
     * @param  {String} key 键
     * @return {Void}
     */
    del: function (key) {
      return invoke(this.st, 'removeItem', [this.name + '.' + key],
        function () {
          return key;
        });
    },

    size: function () {
      return new Promise((resolve,reject)=> {
        var st = this.st,
          k = this.name + '.',
          size = 0;
        for (var i in st) {
          if (st.hasOwnProperty(i) && i.indexOf(k) == 0) {
            size++;
          }
        }
        resolve(size);
      });
    },
    test: function (key) {
      return invoke(this.st, 'getItem', [this.name + '.' + key],
        function (value) {
          return !!value;
        });
    },
    keys: function (prefix) {
      return new Promise((resolve,reject)=> {
        var st = this.st,
          k = this.name + '.',
          buf = [];
        for (var i in st) {
          if (st.hasOwnProperty(i) && i.indexOf(k) == 0) {
            i = i.replace(k, '');
            if (prefix) {
              if (i.indexOf(prefix) >= 0) buf.push(i);
            } else {
              buf.push(i);
            }
          }
        }
        resolve(buf);
      });
    },

    /**
     * 清理指定的前缀的存储数据
     * @param  {String} prefix key前缀
     * @return {Void}
     */
    clean: function (prefix) {
      return new Promise((resolve,reject)=> {
        var st = this.st,
          k = this.name + '.',
          size = 0;
        for (var i in st) {
          if (st.hasOwnProperty(i) && i.indexOf(k) >= 0) {
            if (prefix) {
              if (i.indexOf(prefix) > 0) {
                st.removeItem(i);
                size++;
              }
            } else {
              st.removeItem(i);
              size++;
            }
          }
        }
        resolve(size);
      });
    }
  };

  function MemoryDriver() {
    this.driver = 'MemoryDriver';
    this.cache = {};
  }
  MemoryDriver.prototype = {

    /**
     * 添加数据
     * @param  {String} key   数据键值
     * @param  {Object} value 任意对象
     * @return {Void}
     */
    put: function (key, value, version) {
      return new Promise((resolve,reject)=> {
        this.cache[key] = [value, version];
        this.cache.length++;
        resolve(key, value);
      });
    },

    /**
     * 获取数据
     * @param  {String} key 数据键
     * @return {Object}     key对应数据
     */
    get: function (key) {
      return new Promise((resolve,reject)=> {
        var val = this.cache[key];
        resolve(val ? val[1] === undefined ? val[0] : val : undefined);
      });
    },

    /**
     * 删除key
     * @param  {String} key 键
     * @return {Void}
     */
    del: function (key) {
      return new Promise((resolve,reject)=> {
        var b = delete this.cache[key];
        if (b) this.cache.length--;
        resolve(key);
      });
    },

    size: function () {
      return new Promise((resolve,reject)=> {
        resolve(this.cache.length);
      });
    },

    /**
     * 获取数据
     * @param  {String} key 数据键
     * @return {Object}     key对应数据
     */
    test: function (key) {
      return new Promise((resolve,reject)=> {
        resolve(!!this.cache[key]);
      });
    },

    keys: function (prefix) {
      return new Promise((resolve,reject)=> {
        var st = this.cache,
          buf = [];
        for (var i in st) {
          if (st.hasOwnProperty(i)) {
            if (prefix) {
              if (i.indexOf(prefix) >= 0) buf.push(i);
            } else {
              buf.push(i);
            }
          }
        }
        resolve(buf);
      });
    },

    /**
     * 清理指定的前缀的存储数据
     * @param  {String} prefix key前缀
     * @return {Void}
     */
    clean: function (prefix) {
      return new Promise((resolve,reject)=> {
        var st = this.cache,
          size = 0;
        for (var i in st) {
          if (st.hasOwnProperty(i)) {
            if (prefix) {
              if (i.indexOf(prefix) >= 0 && this._del(i)) size++;
            } else {
              if (this._del(i)) size++;
            }
          }
        }
        resolve(size);
      });
    },

    _del: function (k) {
      var b = delete this.cache[k];
      if (b) {
        this.cache.length--;
      }
      return b;
    }
  };

  /**
   * @description storage构造器
   * @param type {String} 存储类型
   * @param name {String} Storage名称
   */
  function BrowserStorage(type, name) {
    switch (type) {
      default:
        case 'websql':
        this.s = supportWebsql ? new WebsqlDriver(name) : (indexedDB ? new IndexDriver(name) : new MemoryDriver(name));
      break;
      case 'indexdb':
          this.s = new IndexDriver(name);
        break;
      case 'local':
          this.s = new LocalDriver(localStorage, name);
        break;
      case 'session':
          this.s = new LocalDriver(sessionStorage, name);
        break;

      case 'memory':
          this.s = new MemoryDriver(name);
        break;
    }
  }

  BrowserStorage.prototype = {
    /**
     * 添加数据如果存在覆盖原有的数据
     * @param  {String} key   键
     * @param  {Object} value 值
     * @return {Promise}       promise对象
     */
    put: function (key, value, version) {
      return this.s.put(key, value, version);
    },

    /**
     * 获取数据
     * @param  {String} key 数据键
     * @return {Promise}     promise对象
     */
    get: function (key) {
      return this.s.get(key);
    },

    /**
     * 删除key
     * @param  {String} key 键
     * @return {Promise}     promise对象
     */
    del: function (key) {
      return this.s.del(key);
    },

    /**
     * 缓存大小
     * @return {Promise}     promise对象
     */
    size: function () {
      return this.s.size();
    },

    /**
     * 测试键是否存在
     * @param  {String} key 键
     * @return {Promise}     promise对象
     */
    test: function (key) {
      return this.s.test(key);
    },

    /**
     * 所有键
     * @param  {String} prefix 键包含字符串
     * @return {Promise}     promise对象
     */
    keys: function (prefix) {
      return this.s.keys(prefix);
    },
    /**
     * 所有值
     * @param  {String} prefix 键包含字符串
     * @return {Promise}     promise对象
     */
    all: function (prefix) {
      return this.s.all(prefix);
    },

    /**
     * 清理指定的前缀的存储数据
     * @param  {String} prefix key前缀
     * @return {Promise}     promise对象
     */
    clean: function (prefix) {
      return this.s.clean(prefix);
    },

    /**
     * 清空存储库
     * @param  {[type]} prefix [description]
     * @return {[type]}        [description]
     */
    cls: function (prefix) {
      return this.s.cls(prefix);
    },

    toString: function () {
      return this.s.driver;
    }
  };

  if (typeof exports === 'object') {
    // Assume nodejs
    module.exports = BrowserStorage;
  } else {
    if (typeof define === 'function') {
      // AMD module
      define([], function () {
        return BrowserStorage;
      });
    } else if (window) {
      window.BrowserStorage = BrowserStorage;
    }
  }
})(window);