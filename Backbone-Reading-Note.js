(function (root, factory) {
    //root == 当前js环境全局，global or window
    
    //amd模式
    if (typeof define === 'function' && define.amd) {
        define (['underscore', 'jquery', 'exports'], function (_, $, exports) {
            root.Backbone = factory (root, exports, _, $);
        });
    }
    //node require or cmd
    else if (typeof exports !== 'undefined') {
        var _ = require ('underscore');
        //这里有点疑惑为什么不直接传入$，反而是使用全局下面的$，技巧？漏写？
        factory (root, exports, _);
    }
    //其余
    else {
        root.Backbone = factory (root, {}, root._, root.jQuery || root.Zepto || root.ender || root.$);
    }
}) (this, function (root, Backbone, _, $) {
    var previousBackbone = root.Backbone;
    var array = [];
    var push = array.push;
    var slice = array.slice;
    var splice = array.splice;
    Backbone.VERSION = '1.1.2';
    Backbone.$ = $;
    
    //解决冲突，var _b = Backbone.onConflict();
    Backbone.noConflict = function () {
        root.Backbone = previousBackbone;
        return this;
    };
    
    Backbone.emulateHTTP = false;
    Backbone.emulateJSON = false;
    
    /*-------------------------------Events start-----------------------------------------*/
    var Events = Backbone.Events = {
        //下面这些函数的步骤总结起来就是，先用eventsApi去注册jQuery事件，然后再保存/清理/触发_events事件
        on: function (name, callback, context) {
            //参数缺失的情况，例如 name不符合 obj、string spilt 、 null undefined等
            if (! eventsApi (this, 'on', name, [callback, context]) || ! callback) {
                return this;
            }
            
            //注册事件成功，但为了后期操作，存放在对应的_events属性中
            this._events || (this._events = {});
            var events = this._events[name] || (this._events[name] = []);
            events.push ({
                callback: callback,
                context: context,
                ctx: context || this
            });
            
            return this;
        },
        once: function (name, callback, context) {
            if (! eventsApi (this, 'once', name, [callback, context]) || ! callback) {
                return this;
            }
            var self = this;
            var once = _.once (function () {
                //没啥好说的，包装的常用技巧
                self.off (name, once);
                callback.apply (this, arguments);
            });
            once._callback = callback;
            return this.on (name, once, context);
        },
        off: function (name, callback, context) {
            var retain,
                ev,
                events,
                names,
                i,
                l,
                j,
                k;
            
            //jQuery的事件解绑操作是在这一步完成的，下面是对events进行清理
            if (! this._events || ! eventsApi (this, 'off', name, [callback, context])) {
                return this;
            }
            
            //对应Backbone.Events.off(),删除所有的事件
            if (! name && ! callback && ! context) {
                this._events = void 0;
                return this;
            }
            
            //对应Backbone.Events.off("click") or Backbone.Events.off(null,fn?,context?)
            names = name ? [name] : _.keys (this._events);
            for (i = 0, l = names.length; i < l; i ++) {
                name = names[i];
                if (events = this._events[name]) {
                    //retain用来得到过滤之后的事件对象
                    this._events[name] = retain = [];
                    if (callback || context) {
                        for (j = 0, k = events.length; j < k; j ++) {
                            ev = events[j];
                            //不符合fn or context条件的进行对应的保留
                            if (callback && callback !== ev.callback && callback !== ev.callback._callback || context && context !== ev.context) {
                                retain.push (ev);
                            }
                        }
                    }
                    //全部都符合fn or context条件，则这个字段直接删除
                    if (! retain.length) {
                        delete this._events[name];
                    }
                }
            }
            return this;
        },
        trigger: function (name) {
            if (! this._events) {
                return this;
            }
            var args = slice.call (arguments, 1);
            if (! eventsApi (this, 'trigger', name, args)) {
                return this;
            }
            var events = this._events[name];
            var allEvents = this._events.all;
            if (events) {
                triggerEvents (events, args);
            }
            if (allEvents) {
                triggerEvents (allEvents, arguments);
            }
            return this;
        },
        
        //其实与off很类似，其实就是清理自身的_listeningTo保存的事件对象
        stopListening: function (obj, name, callback) {
            var listeningTo = this._listeningTo;
            if (! listeningTo) {
                return this;
            }
            var remove = ! name && ! callback;
            if (! callback && typeof name === 'object') {
                callback = this;
            }
            if (obj) {
                (listeningTo = {})[obj._listenId] = obj;
            }
            for (var id in listeningTo) {
                obj = listeningTo[id];
                obj.off (name, callback, this);
                if (remove || _.isEmpty (obj._events)) {
                    delete this._listeningTo[id];
                }
            }
            return this;
        }
    };
    var eventSplitter = /\s+/;
    
    //调用jQuery事件函数，如果调用成功则返回false,否则true
    var eventsApi = function (obj, action, name, rest) {
        if (! name) {
            return true;
        }
        if (typeof name === 'object') {
            for (var key in name) {
                //调用$obj.on(eventName,fn,context)方法
                obj[action].apply (obj, [key, (name[key])].concat (rest));
            }
            return false;
        }
        if (eventSplitter.test (name)) {
            var names = name.split (eventSplitter);
            //"click mouseover mousemove"的形式
            for (var i = 0, l = names.length; i < l; i ++) {
                obj[action].apply (obj, [(names[i])].concat (rest));
            }
            return false;
        }
        return true;
    };
    
    //事件触发
    var triggerEvents = function (events, args) {
        var ev,
            i = - 1,
            l = events.length,
            a1 = args[0],
            a2 = args[1],
            a3 = args[2];
        switch (args.length) {
            case 0:
                while (++ i < l) {
                    (ev = events[i]).callback.call (ev.ctx);
                }
                return;
            case 1:
                while (++ i < l) {
                    (ev = events[i]).callback.call (ev.ctx, a1);
                }
                return;
            case 2:
                while (++ i < l) {
                    (ev = events[i]).callback.call (ev.ctx, a1, a2);
                }
                return;
            case 3:
                while (++ i < l) {
                    (ev = events[i]).callback.call (ev.ctx, a1, a2, a3);
                }
                return;
            default:
                while (++ i < l) {
                    (ev = events[i]).callback.apply (ev.ctx, args);
                }
                return;
        }
    };
    
    //可以看到，其实ListenTo和ListenToOnce就是on和once，只是进行了一次包装
    var listenMethods = {
        listenTo: 'on',
        listenToOnce: 'once'
    };
    
    //underscore的each方法兼容了obj的解析，implementation = on/once , method = listenTo/ListenToOnce
    _.each (listenMethods, function (implementation, method) {
        Events[method] = function (obj, name, callback) {
            var listeningTo = this._listeningTo || (this._listeningTo = {});
            //_.uniqueId返回唯一的 前缀+randomNum 的 id , 例如下面可能是 l_201，
            //详情参考underscore源码实现（其实就是局部prefix + idContainer自增）
            var id = obj._listenId || (obj._listenId = _.uniqueId ('l'));
            
            //添加到listeningTo里面去
            listeningTo[id] = obj;
            
            //这种情况下，其实callback = context的作用
            if (! callback && typeof name === 'object') {
                callback = this;
            }
            
            //为什么要使用on/once，而不选择重写一个其他方法呢？
            //其实很简单，listenTo的作用是当obj变化的时候能够回掉callback，
            //listenTo和on唯一不同的地方在于this的引用，请看
            //model.listenTo(view,"click",send); send的this == model 而不是 view
            //model.on("click",send); send的this == model
            //而on方法是可以顺利改变this指向，因此复用on是合理的
            obj[implementation] (name, callback, this);
            return this;
        };
    });
    
    //下面没啥好说的，添加Events对象，并且取别名
    Events.bind = Events.on;
    Events.unbind = Events.off;
    _.extend (Backbone, Events);
    /*-------------------------------Events end-----------------------------------------*/
    
    /*---------------------------------Model start---------------------------------------*/
    //Model继承自Events，因此具有所有Events的事件方法
    var Model = Backbone.Model = function (attributes, options) {
        var attrs = attributes || {};
        options || (options = {});
        this.cid = _.uniqueId ('c');
        this.attributes = {};
        
        //指定Model的Collection, new Backbone.Model({},{collection:"xx"});
        if (options.collection) {
            this.collection = options.collection;
        }
        
        //指定Model的parse，parse用来解析参数列表，new Backbone.Model({},{parse:true});
        if (options.parse) {
            //this.parse从Backbone.Model.extend({parse:fn})中来
            attrs = this.parse (attrs, options) || {};
        }
        
        //使用_.result调用this的default方法，具体参考underscore手册
        attrs = _.defaults ({}, attrs, _.result (this, 'defaults'));
        
        //set是原型方法，参考下面的Model.prototype扩展
        this.set (attrs, options);
        this.changed = {};
        
        //自定义初始化函数
        this.initialize.apply (this, arguments);
    };
    _.extend (Model.prototype, Events, {
        changed: null,
        validationError: null,
        idAttribute: 'id',
        initialize: function () {
        },
        toJSON: function (options) {
            return _.clone (this.attributes);
        },
        sync: function () {
            return Backbone.sync.apply (this, arguments);
        },
        get: function (attr) {
            return this.attributes[attr];
        },
        escape: function (attr) {
            return _.escape (this.get (attr));
        },
        has: function (attr) {
            return this.get (attr) != null;
        },
        set: function (key, val, options) {
            var attr,
                attrs,
                unset,
                changes,
                silent,
                changing,
                prev,
                current;
            if (key == null) {
                return this;
            }
            
            //下面都是参数不定的处理情况
            if (typeof key === 'object') {
                attrs = key;
                options = val;
            }
            else {
                (attrs = {})[key] = val;
            }
            options || (options = {});
            
            //kv验证，if(m.set({name:"xxx"},{validate:true}){}
            if (! this._validate (attrs, options)) {
                return false;
            }
            unset = options.unset;
            silent = options.silent;
            changes = [];
            changing = this._changing;
            this._changing = true;
            
            //保留kv副本，但是这里的判断似乎有些多余，但这里是考虑了worker/cluster的情况
            if (! changing) {
                this._previousAttributes = _.clone (this.attributes);
                this.changed = {};
            }
            
            current = this.attributes, prev = this._previousAttributes;
            
            //如果有修改idAttribute，则this.id应该同步
            if (this.idAttribute in attrs) {
                this.id = attrs[this.idAttribute];
            }
            
            for (attr in attrs) {
                val = attrs[attr];
                
                //下面的两个_.isEqual判断其实在非多线程环境下可以合并为一个，因为prev == current
                //changes数组的作用参考下面是触发change:attr事件
                //而this.changed是用来保存改变的属性及变化值，推荐使用副本changedAttribute查看
                if (! _.isEqual (current[attr], val)) {
                    changes.push (attr);
                }
                if (! _.isEqual (prev[attr], val)) {
                    this.changed[attr] = val;
                }
                else {
                    //如果此次操作没有变化，则delete
                    //从上面可知，changed是可能为{}的，但是delete {}[attr]是恒为true
                    //那这种情况用在哪里呢？明显是多线程
                    //例如，原值{name:1}
                    //worker/cluster1 {name:2}进行了修改
                    //worker/cluster2 {name:1}进行了修改
                    //这个时候应该是值无变化操作的，所以应该进行deleteworker/cluster1的改变
                    delete this.changed[attr];
                }
                
                //如果设置了unset参数，那么会删除掉attr属性(changed保留)，否则直接赋值
                //这里主要是给unset方法服务的
                unset ? delete current[attr] : current[attr] = val;
            }
            
            //触发change:attr事件
            if (! silent) {
                if (changes.length) {
                    this._pending = options;
                }
                for (var i = 0, l = changes.length; i < l; i ++) {
                    this.trigger ('change:' + changes[i], this, current[changes[i]], options);
                }
            }
            
            //非主线程直接return了，下面的操作交给主线程进行操作
            if (changing) {
                return this;
            }
            
            //change事件冒泡，与change:attr不同，多线程情况下，change应该只触发一次
            if (! silent) {
                while (this._pending) {
                    options = this._pending;
                    this._pending = false;
                    this.trigger ('change', this, options);
                }
            }
            
            this._pending = false;
            this._changing = false;
            return this;
        },
        unset: function (attr, options) {
            return this.set (attr, void 0, _.extend ({}, options, {
                unset: true
            }));
        },
        clear: function (options) {
            var attrs = {};
            for (var key in this.attributes) {
                attrs[key] = void 0;
            }
            return this.set (attrs, _.extend ({}, options, {
                unset: true
            }));
        },
        hasChanged: function (attr) {
            if (attr == null) {
                return ! _.isEmpty (this.changed);
            }
            return _.has (this.changed, attr);
        },
        changedAttributes: function (diff) {
            if (! diff) {
                return this.hasChanged () ? _.clone (this.changed) : false;
            }
            var val,
                changed = false;
                
            //不用想了，通过分析set方法可知，_changing就是多线程的原子量，下面很好理解了
            var old = this._changing ? this._previousAttributes : this.attributes;
            
            //这里提一下，官方推荐用法为model.changedAttributes(["name"])
            //但是从这里分析可知，还可以用成model.changedAttribute({"name":123})
            //用法一的含义是指，name属性被改变了么？
            //用法二的含义是指，原值123的name值被改变了么？
            for (var attr in diff) {
                if (_.isEqual (old[attr], val = diff[attr])) {
                    continue;
                }
                (changed || (changed = {}))[attr] = val;
            }
            return changed;
        },
        previous: function (attr) {
            if (attr == null || ! this._previousAttributes) {
                return null;
            }
            return this._previousAttributes[attr];
        },
        previousAttributes: function () {
            return _.clone (this._previousAttributes);
        },
        fetch: function (options) {
            options = options ? _.clone (options) : {};
            if (options.parse === void 0) {
                options.parse = true;
            }
            var model = this;
            
            //重新包装success回调
            var success = options.success;
            options.success = function (resp) {
                //parse方法不做修改则只是return resp，当然，Backbone允许你进行覆盖自定义parse
                if (! model.set (model.parse (resp, options), options)) {
                    return false;
                }
                if (success) {
                    success (model, resp, options);
                }
                //如果注册了sync事件的话，我就触发
                model.trigger ('sync', model, resp, options);
            };
            
            //wrapError在代码最末尾，其实就是包装一下error回调而已
            //因为多处使用了，所以进行了封装
            wrapError (this, options);
            
            //sync方法其实是调用了Backbone.sync，
            //根据文档描述，里面的'read'之类的关键字只是用来确认GET POST DELETE PUT等
            //其实质仍然是调用了jQuery.ajax方法
            return this.sync ('read', this, options);
        },
        save: function (key, val, options) {
            var attrs,
                method,
                xhr,
                attributes = this.attributes;
            
            //参数的包装，其实save从参数来看，其实能猜到是调用了set方法的（不信你看下面）
            //save需要注意一下wait的使用，wait == 错误则回滚，成功则覆盖
            if (key == null || typeof key === 'object') {
                attrs = key;
                options = val;
            }
            else {
                (attrs = {})[key] = val;
            }
            
            //没有通过验证，则直接return false了
            options = _.extend ({
                validate: true
            }, options);
            if (attrs && ! options.wait) {
                if (! this.set (attrs, options)) {
                    return false;
                }
            }
            else {
                if (! this._validate (attrs, options)) {
                    return false;
                }
            }
            
            if (attrs && options.wait) {
                this.attributes = _.extend ({}, attributes, attrs);
            }
            
            //下面的操作与fetch相差不大，对回调的封装
            if (options.parse === void 0) {
                options.parse = true;
            }
            var model = this;
            var success = options.success;
            options.success = function (resp) {
                model.attributes = attributes;
                var serverAttrs = model.parse (resp, options);
                if (options.wait) {
                    serverAttrs = _.extend (attrs || {}, serverAttrs);
                }
                //这里实现了wait的回滚操作，验证不通过，则set不成功，return false
                //总结起来就是，前后两次validate的数据验证，实现了wait的作用
                if (_.isObject (serverAttrs) && ! model.set (serverAttrs, options)) {
                    return false;
                }
                if (success) {
                    success (model, resp, options);
                }
                model.trigger ('sync', model, resp, options);
            };
            wrapError (this, options);
            
            //下面其实是针对restful来说的，
            //因为如果是新创建的model，则save相当于后端的create操作
            //如果是旧model，则只是后端的update
            method = this.isNew () ? 'create' : options.patch ? 'patch' : 'update';
            if (method === 'patch') {
                options.attrs = attrs;
            }
            xhr = this.sync (method, this, options);
            
            //为什么会插这么一句？因为从520-523行可以看到,
            //通过validate校验之后对this.attributes进行覆盖，因为你要发ajax了嘛，肯定需要新数据
            //而最开始的保存就是拿在这里使用，目的是success里面的wait回滚操作
            if (attrs && options.wait) {
                this.attributes = attributes;
            }
            return xhr;
        },
        destroy: function (options) {
            options = options ? _.clone (options) : {};
            var model = this;
            var success = options.success;
            var destroy = function () {
                model.trigger ('destroy', model, model.collection, options);
            };
            options.success = function (resp) {
                if (options.wait || model.isNew ()) {
                    destroy ();
                }
                if (success) {
                    success (model, resp, options);
                }
                if (! model.isNew ()) {
                    model.trigger ('sync', model, resp, options);
                }
            };
            
            //如果是新创建的，则后端是不存在这个数据的，直接销毁就好了
            if (this.isNew ()) {
                options.success ();
                return false;
            }
            wrapError (this, options);
            var xhr = this.sync ('delete', this, options);
            
            //提醒一下，destory的触发顺序总是在sync事件之前
            if (! options.wait) {
                destroy ();
            }
            return xhr;
        },
        url: function () {
            var base = _.result (this, 'urlRoot') || _.result (this.collection, 'url') || urlError ();
            if (this.isNew ()) {
                return base;
            }
            //下面这个reg就是给url加末尾的斜杠的，原因是符合restful API
            //1.http://www.index.php ---> http://www.index.php/
            //2.http://www.index.php?kw=1 ---> http://www.index.php?kw=1/
            //这里的返回值主要是给fetch及save后使用的，
            //因为fetch及save后，则数据会有对应的id了呢
            return base.replace (/([^\/])$/, '$1/') + encodeURIComponent (this.id);
        },
        parse: function (resp, options) {
            return resp;
        },
        clone: function () {
            //对象都有constructor函数，backbone里面支持你重写
            //但是initlize方法可不是会被重写的哟
            return new this.constructor (this.attributes);
        },
        isNew: function () {
            return ! this.has (this.idAttribute);
        },
        isValid: function (options) {
            return this._validate ({}, _.extend (options || {}, {
                validate: true
            }));
        },
        _validate: function (attrs, options) {
            //这里说明了，在set的时候可以设定是否校正
            //例如: m.set({},{validate:true}),
            if (! options.validate || ! this.validate) {
                return true;
            }
            attrs = _.extend ({}, this.attributes, attrs);
            var error = this.validationError = this.validate (attrs, options) || null;
            
            //返回任何为true的条件，则会触发invalid事件
            if (! error) {
                return true;
            }
            this.trigger ('invalid', this, error, _.extend (options, {
                validationError: error
            }));
            return false;
        }
    });
    
    //下面就是复制了一下underscore的方法给Model对象原型而已，没啥好说的
    var modelMethods = ['keys', 'values', 'pairs', 'invert', 'pick', 'omit'];
    _.each (modelMethods, function (method) {
        Model.prototype[method] = function () {
            var args = slice.call (arguments);
            args.unshift (this.attributes);
            return _[method].apply (_, args);
        };
    });
    /*-------------------------------Model end-----------------------------------------*/
    
    /*-------------------------------Collection start-----------------------------------------*/
    var Collection = Backbone.Collection = function (models, options) {
        options || (options = {});
        
        //new Backbone.Collection([],{model:Model,comparator:fn})
        if (options.model) {
            this.model = options.model;
        }
        if (options.comparator !== void 0) {
            this.comparator = options.comparator;
        }
        
        //collection初始化
        this._reset ();
        this.initialize.apply (this, arguments);
        
        //直接创建，new Backbone.Collection([models]?)
        if (models) {
            this.reset (models, _.extend ({
                silent: true
            }, options));
        }
    };
    var setOptions = {
        add: true,
        remove: true,
        merge: true
    };
    var addOptions = {
        add: true,
        remove: false
    };
    _.extend (Collection.prototype, Events, {
        model: Model,
        initialize: function () {
        },
        toJSON: function (options) {
            return this.map (function (model) {
                return model.toJSON (options);
            });
        },
        sync: function () {
            return Backbone.sync.apply (this, arguments);
        },
        add: function (models, options) {
            return this.set (models, _.extend ({
                merge: false
            }, options, addOptions));
        },
        remove: function (models, options) {
            //代码太简单，没啥好说的
            var singular = ! _.isArray (models);
            models = singular ? [models] : _.clone (models);
            options || (options = {});
            var i,
                l,
                index,
                model;
            for (i = 0, l = models.length; i < l; i ++) {
                model = models[i] = this.get (models[i]);
                if (! model) {
                    continue;
                }
                delete this._byId[model.id];
                delete this._byId[model.cid];
                index = this.indexOf (model);
                this.models.splice (index, 1);
                this.length --;
                if (! options.silent) {
                    options.index = index;
                    model.trigger ('remove', model, this, options);
                }
                this._removeReference (model, options);
            }
            return singular ? models[0] : models;
        },
        set: function (models, options) {
            options = _.defaults ({}, options, setOptions);
            
            //调用扩展的parse方法
            if (options.parse) {
                models = this.parse (models, options);
            }
            
            var singular = ! _.isArray (models);
            models = singular ? models ? [models] : [] : _.clone (models);
            var i,
                l,
                id,
                model,
                attrs,
                existing,
                sort;
            
            var at = options.at;
            
            //is model , not models
            var targetModel = this.model;
            var sortable = this.comparator && at == null && options.sort !== false;
            var sortAttr = _.isString (this.comparator) ? this.comparator : null;
            
            //从这里其实可以猜到，set方法是会将需要删除和新增的model进行分类的
            //因此后面的remove和add事件触发就是根据你所在remove和add的数组来进行的
            var toAdd = [],
                toRemove = [],
                modelMap = {};
            
            //对于初始化来说，合并merge=false,remove=false,add=true
            //需要注意的是，使用Backbone的set方法，是可以触发两个事件的remove和add
            var add = options.add,
                merge = options.merge,
                remove = options.remove;
                
            var order = ! sortable && add && remove ? [] : false;
            for (i = 0, l = models.length; i < l; i ++) {
                attrs = models[i] || {};
                
                //get一个小技巧，Backbone.Collection的Model不一定是需要继承自Backbone.Model的
                //在某些需要自定义Model的特殊情况下，如果一个对象继承了Backbone.Events即可
                if (attrs instanceof Model) {
                    id = model = attrs;
                }
                else {
                    id = attrs[targetModel.prototype.idAttribute || 'id'];
                }
                
                //从下面可以看出，existing应该是一个model，因此this._byId其实一个model|id|cid => model的一个kv映射
                if (existing = this.get (id)) {
                    //remove=true时旧的model是需要删除的，
                    //因为_.clone(model)进行了深度复制的话，cid新旧model相同，但属性不一定相等
                    if (remove) {
                        modelMap[existing.cid] = true;
                    }
                    if (merge) {
                        //更改attrs指向model.attributes，当然attrs也可能为{}
                        attrs = attrs === model ? model.attributes : attrs;
                        if (options.parse) {
                            attrs = existing.parse (attrs, options);
                        }
                        //model的attribute进行extend（cid才是判断两个model是否相同的标志，不是内存地址）
                        existing.set (attrs, options);
                        if (sortable && ! sort && existing.hasChanged (sortAttr)) {
                            sort = true;
                        }
                    }
                    
                    //保存model对象（主要是针对{}属性的情况）
                    models[i] = existing;
                }
                else if (add) {
                    model = models[i] = this._prepareModel (attrs, options);
                    if (! model) {
                        continue;
                    }
                    toAdd.push (model);
                    this._addReference (model, options);
                }
                
                //结合_addReference的代码可以看到，当model.set({id:"_id"})的时候
                //尽管cid在不断的增加，但是model永远都是在取existing的model(及第一次的model)
                //为什么这么去实现呢？其实很简单，collection相当于数据库表
                //而model相当于表单元，我们知道model.id是与数据库主键对应的
                //主键不允许重复，因此model.id是不允许重复的
                model = existing || model;
                if (order && (model.isNew () || ! modelMap[model.id])) {
                    order.push (model);
                }
                modelMap[model.id] = true;
            }
            
            //删除原有不在新的models里的model
            if (remove) {
                for (i = 0, l = this.length; i < l; ++ i) {
                    //这里为什么用cid了，请看之前的789-791
                    if (! modelMap[(model = this.models[i]).cid]) {
                        toRemove.push (model);
                    }
                }
                if (toRemove.length) {
                    this.remove (toRemove, options);
                }
            }
            
            //增加新的model，下面一堆没啥好说的，代码都很简单
            if (toAdd.length || order && order.length) {
                if (sortable) {
                    sort = true;
                }
                this.length += toAdd.length;
                if (at != null) {
                    for (i = 0, l = toAdd.length; i < l; i ++) {
                        this.models.splice (at + i, 0, toAdd[i]);
                    }
                }
                else {
                    if (order) {
                        this.models.length = 0;
                    }
                    var orderedModels = order || toAdd;
                    for (i = 0, l = orderedModels.length; i < l; i ++) {
                        this.models.push (orderedModels[i]);
                    }
                }
            }
            
            if (sort) {
                this.sort ({
                    silent: true
                });
            }
            if (! options.silent) {
                for (i = 0, l = toAdd.length; i < l; i ++) {
                    (model = toAdd[i]).trigger ('add', model, this, options);
                }
                if (sort || order && order.length) {
                    this.trigger ('sort', this, options);
                }
            }
            return singular ? models[0] : models;
        },
        reset: function (models, options) {
            options || (options = {});
            
            //下面干的事情其实是删除collection引用及model的all事件
            for (var i = 0, l = this.models.length; i < l; i ++) {
                this._removeReference (this.models[i], options);
            }
            
            options.previousModels = this.models;
            this._reset ();
            models = this.add (models, _.extend ({
                silent: true
            }, options));
            if (! options.silent) {
                this.trigger ('reset', this, options);
            }
            return models;
        },
        push: function (model, options) {
            return this.add (model, _.extend ({
                at: this.length
            }, options));
        },
        pop: function (options) {
            var model = this.at (this.length - 1);
            this.remove (model, options);
            return model;
        },
        unshift: function (model, options) {
            return this.add (model, _.extend ({
                at: 0
            }, options));
        },
        shift: function (options) {
            var model = this.at (0);
            this.remove (model, options);
            return model;
        },
        slice: function () {
            return slice.apply (this.models, arguments);
        },
        get: function (obj) {
            if (obj == null) {
                return void 0;
            }
            return this._byId[obj] || this._byId[obj.id] || this._byId[obj.cid];
        },
        at: function (index) {
            return this.models[index];
        },
        where: function (attrs, first) {
            if (_.isEmpty (attrs)) {
                return first ? void 0 : [];
            }
            return this[first ? 'find' : 'filter'] (function (model) {
                for (var key in attrs) {
                    if (attrs[key] !== model.get (key)) {
                        return false;
                    }
                }
                return true;
            });
        },
        findWhere: function (attrs) {
            return this.where (attrs, true);
        },
        sort: function (options) {
            if (! this.comparator) {
                throw new Error ('Cannot sort a set without a comparator');
            }
            options || (options = {});
            if (_.isString (this.comparator) || this.comparator.length === 1) {
                this.models = this.sortBy (this.comparator, this);
            }
            else {
                this.models.sort (_.bind (this.comparator, this));
            }
            if (! options.silent) {
                this.trigger ('sort', this, options);
            }
            return this;
        },
        pluck: function (attr) {
            return _.invoke (this.models, 'get', attr);
        },
        fetch: function (options) {
            options = options ? _.clone (options) : {};
            if (options.parse === void 0) {
                options.parse = true;
            }
            var success = options.success;
            var collection = this;
            options.success = function (resp) {
                var method = options.reset ? 'reset' : 'set';
                collection[method] (resp, options);
                if (success) {
                    success (collection, resp, options);
                }
                collection.trigger ('sync', collection, resp, options);
            };
            wrapError (this, options);
            return this.sync ('read', this, options);
        },
        create: function (model, options) {
            options = options ? _.clone (options) : {};
            if (! (model = this._prepareModel (model, options))) {
                return false;
            }
            if (! options.wait) {
                this.add (model, options);
            }
            var collection = this;
            var success = options.success;
            options.success = function (model, resp) {
                if (options.wait) {
                    collection.add (model, options);
                }
                if (success) {
                    success (model, resp, options);
                }
            };
            model.save (null, options);
            return model;
        },
        parse: function (resp, options) {
            return resp;
        },
        clone: function () {
            return new this.constructor (this.models);
        },
        _reset: function () {
            this.length = 0;
            this.models = [];
            this._byId = {};
        },
        _prepareModel: function (attrs, options) {
            //这里其实就是对只有属性不是model的值进行model的初始化,例如
            //1.Backbone.Collection([{name:1}],{model:Person})
            //2.Backbone.Collection([new Person({name:1})],{model:Person});
            if (attrs instanceof Model) {
                return attrs;
            }
            options = options ? _.clone (options) : {};
            options.collection = this;
            var model = new this.model (attrs, options);
            if (! model.validationError) {
                return model;
            }
            this.trigger ('invalid', this, model.validationError, options);
            return false;
        },
        _addReference: function (model, options) {
            this._byId[model.cid] = model;
            
            //从Model我们知道，一个一类Model的id是相同的，在set({id:"_id"})的时候，
            //其实id与idAttribute都是会变化为相同的值，
            //所以下面的代码只会保留一个model的信息（与上面model.cid不同，cid是每个model唯一且不同的）
            /**
             *  可以试验下面的这个代码
                var c = new Backbone.Collection([],{model:Backbone.Model});
                for(var i = 0 ; i < 3; i ++){
                    var b = new Backbone.Model({id:"_id"});
                    c.add(b);
                }
             */
            if (model.id != null) {
                this._byId[model.id] = model;
            }
            if (! model.collection) {
                model.collection = this;
            }
            model.on ('all', this._onModelEvent, this);
        },
        _removeReference: function (model, options) {
            
            //防止循环引用造成内存泄露
            if (this === model.collection) {
                delete model.collection;
            }
            
            model.off ('all', this._onModelEvent, this);
        },
        _onModelEvent: function (event, model, collection, options) {
            //对于collection的all事件来说，是不触发model的add || remove事件的
            //collection != this在这里的判断是为了确保当前的model.collection == this
            //因为collection中的model是可以被人为更改的
            if ((event === 'add' || event === 'remove') && collection !== this) {
                return;
            }
            if (event === 'destroy') {
                this.remove (model, options);
            }
            if (model && event === 'change:' + model.idAttribute) {
                delete this._byId[model.previous (model.idAttribute)];
                if (model.id != null) {
                    this._byId[model.id] = model;
                }
            }
            
            //从上面的代码可以看到，事件首先都是model被触发，然后轮到collection
            this.trigger.apply (this, arguments);
        }
    });
    
    var methods = ['forEach', 'each', 'map', 'collect', 'reduce', 'foldl', 'inject', 'reduceRight', 'foldr', 'find', 'detect', 'filter', 'select', 'reject', 'every', 'all', 'some', 'any', 'include', 'contains', 'invoke', 'max', 'min', 'toArray', 'size', 'first', 'head', 'take', 'initial', 'rest', 'tail', 'drop', 'last', 'without', 'difference', 'indexOf', 'shuffle', 'lastIndexOf', 'isEmpty', 'chain', 'sample'];
    _.each (methods, function (method) {
        Collection.prototype[method] = function () {
            var args = slice.call (arguments);
            args.unshift (this.models);
            return _[method].apply (_, args);
        };
    });
    
    var attributeMethods = ['groupBy', 'countBy', 'sortBy', 'indexBy'];
    _.each (attributeMethods, function (method) {
        Collection.prototype[method] = function (value, context) {
            var iterator = _.isFunction (value) ? value : function (model) {
                return model.get (value);
            };
            return _[method] (this.models, iterator, context);
        };
    });
    /*-------------------------------Collection end-----------------------------------------*/
    
    
    /*-------------------------------View start-----------------------------------------*/
    var View = Backbone.View = function (options) {
        this.cid = _.uniqueId ('view');
        options || (options = {});
        _.extend (this, _.pick (options, viewOptions));
        this._ensureElement ();
        this.initialize.apply (this, arguments);
        this.delegateEvents ();
    };
    var delegateEventSplitter = /^(\S+)\s*(.*)$/;
    var viewOptions = ['model', 'collection', 'el', 'id', 'attributes', 'className', 'tagName', 'events'];
    _.extend (View.prototype, Events, {
        tagName: 'div',
        $: function (selector) {
            return this.$el.find (selector);
        },
        initialize: function () {
        },
        render: function () {
            return this;
        },
        remove: function () {
            this.$el.remove ();
            this.stopListening();
            return this;
        },
        setElement: function (element, delegate) {
            //更换el时，取消所有事件代理，避免内存泄漏
            if (this.$el) {
                this.undelegateEvents ();
            }
            
            //jQuery对象的封装
            this.$el = element instanceof Backbone.$ ? element : Backbone.$ (element);
            this.el = this.$el[0];
            
            //恢复事件代理，新创建view的时候不采用
            if (delegate !== false) {
                this.delegateEvents ();
            }
            
            return this;
        },
        delegateEvents: function (events) {
            if (! (events || (events = _.result (this, 'events')))) {
                return this;
            }
            
            //每个view只能够去代理一个事件
            this.undelegateEvents ();
            
            //events属性的写法是（如下），下面只是对这些进行拆分而已
            /*
               events: {
                    "click .icon":          "open",
                    "click .button.edit":   "openEditDialog",
                    "click .button.delete": "destroy"
                  },
             */
            for (var key in events) {
                var method = events[key];
                
                //取"open"
                if (! _.isFunction (method)) {
                    method = this[events[key]];
                }
                if (! method) {
                    continue;
                }
                //key分隔,分割为click -- .icon
                var match = key.match (delegateEventSplitter);
                var eventName = match[1],
                    selector = match[2];
                method = _.bind (method, this);
                //.delegateEvents+cid为此代理事件的命名空间，例如keydown.myEvents
                eventName += '.delegateEvents' + this.cid;
                if (selector === '') {
                    this.$el.on (eventName, method);
                }
                else {
                    this.$el.on (eventName, selector, method);
                }
            }
            return this;
        },
        undelegateEvents: function () {
            this.$el.off ('.delegateEvents' + this.cid);
            return this;
        },
        _ensureElement: function () {
            //如果不设置el属性，那么Backbone从其余属性中进行解析创建
            if (! this.el) {
                var attrs = _.extend ({}, _.result (this, 'attributes'));
                if (this.id) {
                    attrs.id = _.result (this, 'id');
                }
                if (this.className) {
                    attrs['class'] = _.result (this, 'className');
                }
                var $el = Backbone.$ ('<' + _.result (this, 'tagName') + '>').attr (attrs);
                this.setElement ($el, false);
            }
            else {
                this.setElement (_.result (this, 'el'), false);
            }
        }
    });
    /*-------------------------------View end-----------------------------------------*/
    
    /*-----------------------------Sync start---------------------------------------*/
    Backbone.sync = function (method, model, options) {
        var type = methodMap[method];
        
        //不支持Restful的服务器，那么需要使用POST\GET模拟请求
        _.defaults (options || (options = {}), {
            emulateHTTP: Backbone.emulateHTTP,
            emulateJSON: Backbone.emulateJSON
        });
        var params = {
            type: type,
            dataType: 'json'
        };
        
        //这里的取名是不严谨的， model参数既可是model也可能是collection
        if (! options.url) {
            params.url = _.result (model, 'url') || urlError ();
        }
        if (options.data == null && model && (method === 'create' || method === 'update' || method === 'patch')) {
            params.contentType = 'application/json';
            params.data = JSON.stringify (options.attrs || model.toJSON (options));
        }
        if (options.emulateJSON) {
            params.contentType = 'application/x-www-form-urlencoded';
            params.data = params.data ? {
                model: params.data
            } : {};
        }
        
        //这里是针对不支持Restful的服务器采取的兼容方法，
        //详情见：http://www.hanselman.com/blog/HTTPPUTOrDELETENotAllowedUseXHTTPMethodOverrideForYourRESTServiceWithASPNETWebAPI.aspx
        if (options.emulateHTTP && (type === 'PUT' || type === 'DELETE' || type === 'PATCH')) {
            params.type = 'POST';
            if (options.emulateJSON) {
                params.data._method = type;
            }
            var beforeSend = options.beforeSend;
            //tips,可以附加beforeSend参数，例如xhr.cridient之类的设定
            options.beforeSend = function (xhr) {
                xhr.setRequestHeader ('X-HTTP-Method-Override', type);
                if (beforeSend) {
                    return beforeSend.apply (this, arguments);
                }
            };
        }
        
        if (params.type !== 'GET' && ! options.emulateJSON) {
            //除GET之外的不允许自动转换配合x-www-form-urlencoded
            params.processData = false;
        }
        
        //这里有点不理解，$.ajax默认IE是ActiveXObject，这里为了PATCH来做了一个兼容？
        if (params.type === 'PATCH' && noXhrPatch) {
            params.xhr = function () {
                return new ActiveXObject ("Microsoft.XMLHTTP");
            };
        }
        
        var xhr = options.xhr = Backbone.ajax (_.extend (params, options));
        model.trigger ('request', model, xhr, options);
        return xhr;
    };
    var noXhrPatch = typeof window !== 'undefined' && ! ! window.ActiveXObject && ! (window.XMLHttpRequest && new XMLHttpRequest ().dispatchEvent);
    var methodMap = {
        'create': 'POST',
        'update': 'PUT',
        'patch': 'PATCH',
        'delete': 'DELETE',
        'read': 'GET'
    };
    Backbone.ajax = function () {
        return Backbone.$.ajax.apply (Backbone.$, arguments);
    };
    /*-----------------------------Sync end---------------------------------------*/
    
    /*-----------------------------Router start---------------------------------------*/
    var Router = Backbone.Router = function (options) {
        options || (options = {});
        if (options.routes) {
            this.routes = options.routes;
        }
        this._bindRoutes ();
        this.initialize.apply (this, arguments);
    };
    var optionalParam = /\((.*?)\)/g;
    var namedParam = /(\(\?)?:\w+/g;
    var splatParam = /\*\w+/g;
    var escapeRegExp = /[\-{}\[\]+?.,\\\^$|#\s]/g;
    _.extend (Router.prototype, Events, {
        initialize: function () {
        },
        route: function (route, name, callback) {
            //如果不是正则表达式的route，那么就转换为正则表达式形式
            //下面的_routeToRegExp方法可以不用去看，没啥意义，知道转换为正则形式就好了
            if (! _.isRegExp (route)) {
                route = this._routeToRegExp (route);
            }
            
            if (_.isFunction (name)) {
                callback = name;
                name = '';
            }
            
            if (! callback) {
                callback = this[name];
            }
            
            var router = this;
            Backbone.history.route (route, function (fragment) {
                var args = router._extractParameters (route, fragment);
                router.execute (callback, args);
                
                //注意下面的3个触发顺序
                router.trigger.apply (router, [('route:' + name)].concat (args));
                router.trigger ('route', name, args);
                Backbone.history.trigger ('route', router, name, args);
            });
            return this;
        },
        execute: function (callback, args) {
            if (callback) {
                callback.apply (this, args);
            }
        },
        navigate: function (fragment, options) {
            Backbone.history.navigate (fragment, options);
            return this;
        },
        _bindRoutes: function () {
            if (! this.routes) {
                return;
            }
            
            //kv分离，绑定函数
            this.routes = _.result (this, 'routes');
            var route,
                routes = _.keys (this.routes);
            while ((route = routes.pop ()) != null) {
                this.route (route, this.routes[route]);
            }
        },
        _routeToRegExp: function (route) {
            route = route.replace (escapeRegExp, '\\$&').replace (optionalParam, '(?:$1)?').replace (namedParam, function (match, optional) {
                return optional ? match : '([^/?]+)';
            }).replace (splatParam, '([^?]*?)');
            return new RegExp ('^' + route + '(?:\\?([\\s\\S]*))?$');
        },
        _extractParameters: function (route, fragment) {
            //正则匹配，然后获取到参数
            //例如注册了/index/:id/:path 这样的router，那么当访问/index/1/home时
            //params获取的就是[1,"home"]，跟后端MVC的写法是一样的
            var params = route.exec (fragment).slice (1);
            
            return _.map (params, function (param, i) {
                
                //这里为什么还要这样判断呢，应该是正则有其余的处理，
                //看代码的话这一块没必要去了解，反正知道这一坨就是处理参数就ok
                if (i === params.length - 1) {
                    return param || null;
                }
                return param ? decodeURIComponent (param) : null;
            });
        }
    });
    /*-----------------------------Router end---------------------------------------*/
    
    /*-----------------------------History start---------------------------------------*/
    var History = Backbone.History = function () {
        this.handlers = [];
        _.bindAll (this, 'checkUrl');
        if (typeof window !== 'undefined') {
            this.location = window.location;
            this.history = window.history;
        }
    };
    var routeStripper = /^[#\/]|\s+$/g;
    var rootStripper = /^\/+|\/+$/g;
    var isExplorer = /msie [\w.]+/;
    var trailingSlash = /\/$/;
    var pathStripper = /#.*$/;
    History.started = false;
    _.extend (History.prototype, Events, {
        interval: 50,
        atRoot: function () {
            return this.location.pathname.replace (/[^\/]$/, '$&/') === this.root;
        },
        getHash: function (window) {
            var match = (window || this).location.href.match (/#(.*)$/);
            return match ? match[1] : '';
        },
        getFragment: function (fragment, forcePushState) {
            if (fragment == null) {
                if (this._hasPushState || ! this._wantsHashChange || forcePushState) {
                    //单页地址信息的location变化
                    fragment = decodeURI (this.location.pathname + this.location.search);
                    var root = this.root.replace (trailingSlash, '');
                    if (! fragment.indexOf (root)) {
                        fragment = fragment.slice (root.length);
                    }
                }
                else {
                    fragment = this.getHash ();
                }
            }
            return fragment.replace (routeStripper, '');
        },
        start: function (options) {
            if (History.started) {
                throw new Error ("Backbone.history has already been started");
            }
            History.started = true;
            this.options = _.extend ({
                root: '/'
            }, this.options, options);
            
            this.root = this.options.root;
            
            //以下是确认采用hash的方式还是pushState的方式
            this._wantsHashChange = this.options.hashChange !== false;
            this._wantsPushState = ! ! this.options.pushState;
            this._hasPushState = ! ! (this.options.pushState && this.history && this.history.pushState);
            
            //对于IE6(IE7-IE8没试过)来说，要实现hash保存浏览记录的话
            //是需要创建一个隐藏的iframe，然后open+close并更新iframe的location
            //并定时更新主窗口，这个方法最早出现在jQuery-history-plugin吧应该
            var fragment = this.getFragment ();
            var docMode = document.documentMode;
            var oldIE = isExplorer.exec (navigator.userAgent.toLowerCase ()) && (! docMode || docMode <= 7);
            this.root = ('/' + this.root + '/').replace (rootStripper, '/');
            if (oldIE && this._wantsHashChange) {
                var frame = Backbone.$ ('<iframe src="javascript:0" tabindex="-1">');
                this.iframe = frame.hide ().appendTo ('body')[0].contentWindow;
                this.navigate (fragment);
            }
            
            if (this._hasPushState) {
                Backbone.$ (window).on ('popstate', this.checkUrl);
            }
            else if (this._wantsHashChange && 'onhashchange' in window && ! oldIE) {
                Backbone.$ (window).on ('hashchange', this.checkUrl);
            }
            else if (this._wantsHashChange) {
                //这个应该是针对IE6的，IE6是没有hashchange这个事件的，只能通过setInterval不断进行检测
                this._checkUrlInterval = setInterval (this.checkUrl, this.interval);
            }
            
            this.fragment = fragment;
            var loc = this.location;
            if (this._wantsHashChange && this._wantsPushState) {
                if (! this._hasPushState && ! this.atRoot ()) {
                    this.fragment = this.getFragment (null, true);
                    this.location.replace (this.root + '#' + this.fragment);
                    return true;
                }
                else if (this._hasPushState && this.atRoot () && loc.hash) {
                    this.fragment = this.getHash ().replace (routeStripper, '');
                    this.history.replaceState ({}, document.title, this.root + this.fragment);
                }
            }
            if (! this.options.silent) {
                return this.loadUrl ();
            }
        },
        stop: function () {
            Backbone.$ (window).off ('popstate', this.checkUrl).off ('hashchange', this.checkUrl);
            if (this._checkUrlInterval) {
                clearInterval (this._checkUrlInterval);
            }
            History.started = false;
        },
        route: function (route, callback) {
            this.handlers.unshift ({
                route: route,
                callback: callback
            });
        },
        checkUrl: function (e) {
            var current = this.getFragment ();
            if (current === this.fragment && this.iframe) {
                current = this.getFragment (this.getHash (this.iframe));
            }
            if (current === this.fragment) {
                return false;
            }
            if (this.iframe) {
                this.navigate (current);
            }
            this.loadUrl ();
        },
        loadUrl: function (fragment) {
            //其实就是函数执行，执行符合当前hash的映射函数
            fragment = this.fragment = this.getFragment (fragment);
            return _.any (this.handlers, function (handler) {
                if (handler.route.test (fragment)) {
                    handler.callback (fragment);
                    return true;
                }
            });
        },
        navigate: function (fragment, options) {
            if (! History.started) {
                return false;
            }
            if (! options || options === true) {
                options = {
                    trigger: ! ! options
                };
            }
            var url = this.root + (fragment = this.getFragment (fragment || ''));
            fragment = fragment.replace (pathStripper, '');
            
            if (this.fragment === fragment) {
                return;
            }
            this.fragment = fragment;
            if (fragment === '' && url !== '/') {
                url = url.slice (0, - 1);
            }
            if (this._hasPushState) {
                this.history[options.replace ? 'replaceState' : 'pushState'] ({}, document.title, url);
            }
            else if (this._wantsHashChange) {
                this._updateHash (this.location, fragment, options.replace);
                //如果有iframe并且hash变化
                if (this.iframe && fragment !== this.getFragment (this.getHash (this.iframe))) {
                    if (! options.replace) {
                        this.iframe.document.open ().close ();
                    }
                    this._updateHash (this.iframe.location, fragment, options.replace);
                }
            }
            else {
                return this.location.assign (url);
            }
            if (options.trigger) {
                return this.loadUrl (fragment);
            }
        },
        _updateHash: function (location, fragment, replace) {
            if (replace) {
                var href = location.href.replace (/(javascript:|#).*$/, '');
                location.replace (href + '#' + fragment);
            }
            else {
                location.hash = '#' + fragment;
            }
        }
    });
    Backbone.history = new History ();
    /*-----------------------------History end---------------------------------------*/
    
    var extend = function (protoProps, staticProps) {
        var parent = this;
        var child;
        if (protoProps && _.has (protoProps, 'constructor')) {
            child = protoProps.constructor;
        }
        else {
            child = function () {
                return parent.apply (this, arguments);
            };
        }
        _.extend (child, parent, staticProps);
        var Surrogate = function () {
            this.constructor = child;
        };
        Surrogate.prototype = parent.prototype;
        child.prototype = new Surrogate ();
        if (protoProps) {
            _.extend (child.prototype, protoProps);
        }
        child.__super__ = parent.prototype;
        return child;
    };
    Model.extend = Collection.extend = Router.extend = View.extend = History.extend = extend;
    var urlError = function () {
        throw new Error ('A "url" property or function must be specified');
    };
    var wrapError = function (model, options) {
        var error = options.error;
        options.error = function (resp) {
            if (error) {
                error (model, resp, options);
            }
            model.trigger ('error', model, resp, options);
        };
    };
    
    return Backbone;
});
