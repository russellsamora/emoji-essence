
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.head.appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function flush() {
        const seen_callbacks = new Set();
        do {
            // first, call beforeUpdate functions
            // and update components
            while (dirty_components.length) {
                const component = dirty_components.shift();
                set_current_component(component);
                update(component.$$);
            }
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    callback();
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }

    const globals = (typeof window !== 'undefined' ? window : global);
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(children(options.target));
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.17.0' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
    }

    function ascending(a, b) {
      return a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
    }

    function bisector(compare) {
      if (compare.length === 1) compare = ascendingComparator(compare);
      return {
        left: function(a, x, lo, hi) {
          if (lo == null) lo = 0;
          if (hi == null) hi = a.length;
          while (lo < hi) {
            var mid = lo + hi >>> 1;
            if (compare(a[mid], x) < 0) lo = mid + 1;
            else hi = mid;
          }
          return lo;
        },
        right: function(a, x, lo, hi) {
          if (lo == null) lo = 0;
          if (hi == null) hi = a.length;
          while (lo < hi) {
            var mid = lo + hi >>> 1;
            if (compare(a[mid], x) > 0) hi = mid;
            else lo = mid + 1;
          }
          return lo;
        }
      };
    }

    function ascendingComparator(f) {
      return function(d, x) {
        return ascending(f(d), x);
      };
    }

    var ascendingBisect = bisector(ascending);

    function descending(a, b) {
      return b < a ? -1 : b > a ? 1 : b >= a ? 0 : NaN;
    }

    var noop$1 = {value: function() {}};

    function dispatch() {
      for (var i = 0, n = arguments.length, _ = {}, t; i < n; ++i) {
        if (!(t = arguments[i] + "") || (t in _) || /[\s.]/.test(t)) throw new Error("illegal type: " + t);
        _[t] = [];
      }
      return new Dispatch(_);
    }

    function Dispatch(_) {
      this._ = _;
    }

    function parseTypenames(typenames, types) {
      return typenames.trim().split(/^|\s+/).map(function(t) {
        var name = "", i = t.indexOf(".");
        if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
        if (t && !types.hasOwnProperty(t)) throw new Error("unknown type: " + t);
        return {type: t, name: name};
      });
    }

    Dispatch.prototype = dispatch.prototype = {
      constructor: Dispatch,
      on: function(typename, callback) {
        var _ = this._,
            T = parseTypenames(typename + "", _),
            t,
            i = -1,
            n = T.length;

        // If no callback was specified, return the callback of the given type and name.
        if (arguments.length < 2) {
          while (++i < n) if ((t = (typename = T[i]).type) && (t = get(_[t], typename.name))) return t;
          return;
        }

        // If a type was specified, set the callback for the given type and name.
        // Otherwise, if a null callback was specified, remove callbacks of the given name.
        if (callback != null && typeof callback !== "function") throw new Error("invalid callback: " + callback);
        while (++i < n) {
          if (t = (typename = T[i]).type) _[t] = set(_[t], typename.name, callback);
          else if (callback == null) for (t in _) _[t] = set(_[t], typename.name, null);
        }

        return this;
      },
      copy: function() {
        var copy = {}, _ = this._;
        for (var t in _) copy[t] = _[t].slice();
        return new Dispatch(copy);
      },
      call: function(type, that) {
        if ((n = arguments.length - 2) > 0) for (var args = new Array(n), i = 0, n, t; i < n; ++i) args[i] = arguments[i + 2];
        if (!this._.hasOwnProperty(type)) throw new Error("unknown type: " + type);
        for (t = this._[type], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
      },
      apply: function(type, that, args) {
        if (!this._.hasOwnProperty(type)) throw new Error("unknown type: " + type);
        for (var t = this._[type], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
      }
    };

    function get(type, name) {
      for (var i = 0, n = type.length, c; i < n; ++i) {
        if ((c = type[i]).name === name) {
          return c.value;
        }
      }
    }

    function set(type, name, callback) {
      for (var i = 0, n = type.length; i < n; ++i) {
        if (type[i].name === name) {
          type[i] = noop$1, type = type.slice(0, i).concat(type.slice(i + 1));
          break;
        }
      }
      if (callback != null) type.push({name: name, value: callback});
      return type;
    }

    var emptyOn = dispatch("start", "end", "cancel", "interrupt");

    var prefix = "$";

    function Map$1() {}

    Map$1.prototype = map.prototype = {
      constructor: Map$1,
      has: function(key) {
        return (prefix + key) in this;
      },
      get: function(key) {
        return this[prefix + key];
      },
      set: function(key, value) {
        this[prefix + key] = value;
        return this;
      },
      remove: function(key) {
        var property = prefix + key;
        return property in this && delete this[property];
      },
      clear: function() {
        for (var property in this) if (property[0] === prefix) delete this[property];
      },
      keys: function() {
        var keys = [];
        for (var property in this) if (property[0] === prefix) keys.push(property.slice(1));
        return keys;
      },
      values: function() {
        var values = [];
        for (var property in this) if (property[0] === prefix) values.push(this[property]);
        return values;
      },
      entries: function() {
        var entries = [];
        for (var property in this) if (property[0] === prefix) entries.push({key: property.slice(1), value: this[property]});
        return entries;
      },
      size: function() {
        var size = 0;
        for (var property in this) if (property[0] === prefix) ++size;
        return size;
      },
      empty: function() {
        for (var property in this) if (property[0] === prefix) return false;
        return true;
      },
      each: function(f) {
        for (var property in this) if (property[0] === prefix) f(this[property], property.slice(1), this);
      }
    };

    function map(object, f) {
      var map = new Map$1;

      // Copy constructor.
      if (object instanceof Map$1) object.each(function(value, key) { map.set(key, value); });

      // Index array by numeric index or specified key function.
      else if (Array.isArray(object)) {
        var i = -1,
            n = object.length,
            o;

        if (f == null) while (++i < n) map.set(i, object[i]);
        else while (++i < n) map.set(f(o = object[i], i, object), o);
      }

      // Convert object to map.
      else if (object) for (var key in object) map.set(key, object[key]);

      return map;
    }

    function Set$1() {}

    var proto = map.prototype;

    Set$1.prototype = set$1.prototype = {
      constructor: Set$1,
      has: proto.has,
      add: function(value) {
        value += "";
        this[prefix + value] = value;
        return this;
      },
      remove: proto.remove,
      clear: proto.clear,
      values: proto.keys,
      size: proto.size,
      empty: proto.empty,
      each: proto.each
    };

    function set$1(object, f) {
      var set = new Set$1;

      // Copy constructor.
      if (object instanceof Set$1) object.each(function(value) { set.add(value); });

      // Otherwise, assume it’s an array.
      else if (object) {
        var i = -1, n = object.length;
        if (f == null) while (++i < n) set.add(object[i]);
        else while (++i < n) set.add(f(object[i], i, object));
      }

      return set;
    }

    var emojiData = [
      {
        "number": 1,
        "code": "U+1F600",
        "browser": "😀",
        "shortname": "grinning face"
      },
      {
        "number": 2,
        "code": "U+1F603",
        "browser": "😃",
        "shortname": "grinning face with big eyes"
      },
      {
        "number": 3,
        "code": "U+1F604",
        "browser": "😄",
        "shortname": "grinning face with smiling eyes"
      },
      {
        "number": 4,
        "code": "U+1F601",
        "browser": "😁",
        "shortname": "beaming face with smiling eyes"
      },
      {
        "number": 5,
        "code": "U+1F606",
        "browser": "😆",
        "shortname": "grinning squinting face"
      },
      {
        "number": 6,
        "code": "U+1F605",
        "browser": "😅",
        "shortname": "grinning face with sweat"
      },
      {
        "number": 7,
        "code": "U+1F923",
        "browser": "🤣",
        "shortname": "rolling on the floor laughing"
      },
      {
        "number": 8,
        "code": "U+1F602",
        "browser": "😂",
        "shortname": "face with tears of joy"
      },
      {
        "number": 9,
        "code": "U+1F642",
        "browser": "🙂",
        "shortname": "slightly smiling face"
      },
      {
        "number": 10,
        "code": "U+1F643",
        "browser": "🙃",
        "shortname": "upside-down face"
      },
      {
        "number": 11,
        "code": "U+1F609",
        "browser": "😉",
        "shortname": "winking face"
      },
      {
        "number": 12,
        "code": "U+1F60A",
        "browser": "😊",
        "shortname": "smiling face with smiling eyes"
      },
      {
        "number": 13,
        "code": "U+1F607",
        "browser": "😇",
        "shortname": "smiling face with halo"
      },
      {
        "number": 15,
        "code": "U+1F60D",
        "browser": "😍",
        "shortname": "smiling face with heart-eyes"
      },
      {
        "number": 17,
        "code": "U+1F618",
        "browser": "😘",
        "shortname": "face blowing a kiss"
      },
      {
        "number": 18,
        "code": "U+1F617",
        "browser": "😗",
        "shortname": "kissing face"
      },
      {
        "number": 19,
        "code": "U+263A",
        "browser": "☺",
        "shortname": "smiling face"
      },
      {
        "number": 20,
        "code": "U+1F61A",
        "browser": "😚",
        "shortname": "kissing face with closed eyes"
      },
      {
        "number": 21,
        "code": "U+1F619",
        "browser": "😙",
        "shortname": "kissing face with smiling eyes"
      },
      {
        "number": 22,
        "code": "U+1F60B",
        "browser": "😋",
        "shortname": "face savoring food"
      },
      {
        "number": 23,
        "code": "U+1F61B",
        "browser": "😛",
        "shortname": "face with tongue"
      },
      {
        "number": 24,
        "code": "U+1F61C",
        "browser": "😜",
        "shortname": "winking face with tongue"
      },
      {
        "number": 26,
        "code": "U+1F61D",
        "browser": "😝",
        "shortname": "squinting face with tongue"
      },
      {
        "number": 27,
        "code": "U+1F911",
        "browser": "🤑",
        "shortname": "money-mouth face"
      },
      {
        "number": 28,
        "code": "U+1F917",
        "browser": "🤗",
        "shortname": "hugging face"
      },
      {
        "number": 31,
        "code": "U+1F914",
        "browser": "🤔",
        "shortname": "thinking face"
      },
      {
        "number": 32,
        "code": "U+1F910",
        "browser": "🤐",
        "shortname": "zipper-mouth face"
      },
      {
        "number": 34,
        "code": "U+1F610",
        "browser": "😐",
        "shortname": "neutral face"
      },
      {
        "number": 35,
        "code": "U+1F611",
        "browser": "😑",
        "shortname": "expressionless face"
      },
      {
        "number": 36,
        "code": "U+1F636",
        "browser": "😶",
        "shortname": "face without mouth"
      },
      {
        "number": 37,
        "code": "U+1F60F",
        "browser": "😏",
        "shortname": "smirking face"
      },
      {
        "number": 38,
        "code": "U+1F612",
        "browser": "😒",
        "shortname": "unamused face"
      },
      {
        "number": 39,
        "code": "U+1F644",
        "browser": "🙄",
        "shortname": "face with rolling eyes"
      },
      {
        "number": 40,
        "code": "U+1F62C",
        "browser": "😬",
        "shortname": "grimacing face"
      },
      {
        "number": 41,
        "code": "U+1F925",
        "browser": "🤥",
        "shortname": "lying face"
      },
      {
        "number": 42,
        "code": "U+1F60C",
        "browser": "😌",
        "shortname": "relieved face"
      },
      {
        "number": 43,
        "code": "U+1F614",
        "browser": "😔",
        "shortname": "pensive face"
      },
      {
        "number": 44,
        "code": "U+1F62A",
        "browser": "😪",
        "shortname": "sleepy face"
      },
      {
        "number": 45,
        "code": "U+1F924",
        "browser": "🤤",
        "shortname": "drooling face"
      },
      {
        "number": 46,
        "code": "U+1F634",
        "browser": "😴",
        "shortname": "sleeping face"
      },
      {
        "number": 47,
        "code": "U+1F637",
        "browser": "😷",
        "shortname": "face with medical mask"
      },
      {
        "number": 48,
        "code": "U+1F912",
        "browser": "🤒",
        "shortname": "face with thermometer"
      },
      {
        "number": 49,
        "code": "U+1F915",
        "browser": "🤕",
        "shortname": "face with head-bandage"
      },
      {
        "number": 50,
        "code": "U+1F922",
        "browser": "🤢",
        "shortname": "nauseated face"
      },
      {
        "number": 52,
        "code": "U+1F927",
        "browser": "🤧",
        "shortname": "sneezing face"
      },
      {
        "number": 56,
        "code": "U+1F635",
        "browser": "😵",
        "shortname": "dizzy face"
      },
      {
        "number": 58,
        "code": "U+1F920",
        "browser": "🤠",
        "shortname": "cowboy hat face"
      },
      {
        "number": 60,
        "code": "U+1F60E",
        "browser": "😎",
        "shortname": "smiling face with sunglasses"
      },
      {
        "number": 61,
        "code": "U+1F913",
        "browser": "🤓",
        "shortname": "nerd face"
      },
      {
        "number": 63,
        "code": "U+1F615",
        "browser": "😕",
        "shortname": "confused face"
      },
      {
        "number": 64,
        "code": "U+1F61F",
        "browser": "😟",
        "shortname": "worried face"
      },
      {
        "number": 65,
        "code": "U+1F641",
        "browser": "🙁",
        "shortname": "slightly frowning face"
      },
      {
        "number": 66,
        "code": "U+2639",
        "browser": "☹",
        "shortname": "frowning face"
      },
      {
        "number": 67,
        "code": "U+1F62E",
        "browser": "😮",
        "shortname": "face with open mouth"
      },
      {
        "number": 68,
        "code": "U+1F62F",
        "browser": "😯",
        "shortname": "hushed face"
      },
      {
        "number": 69,
        "code": "U+1F632",
        "browser": "😲",
        "shortname": "astonished face"
      },
      {
        "number": 70,
        "code": "U+1F633",
        "browser": "😳",
        "shortname": "flushed face"
      },
      {
        "number": 72,
        "code": "U+1F626",
        "browser": "😦",
        "shortname": "frowning face with open mouth"
      },
      {
        "number": 73,
        "code": "U+1F627",
        "browser": "😧",
        "shortname": "anguished face"
      },
      {
        "number": 74,
        "code": "U+1F628",
        "browser": "😨",
        "shortname": "fearful face"
      },
      {
        "number": 75,
        "code": "U+1F630",
        "browser": "😰",
        "shortname": "anxious face with sweat"
      },
      {
        "number": 76,
        "code": "U+1F625",
        "browser": "😥",
        "shortname": "sad but relieved face"
      },
      {
        "number": 77,
        "code": "U+1F622",
        "browser": "😢",
        "shortname": "crying face"
      },
      {
        "number": 78,
        "code": "U+1F62D",
        "browser": "😭",
        "shortname": "loudly crying face"
      },
      {
        "number": 79,
        "code": "U+1F631",
        "browser": "😱",
        "shortname": "face screaming in fear"
      },
      {
        "number": 80,
        "code": "U+1F616",
        "browser": "😖",
        "shortname": "confounded face"
      },
      {
        "number": 81,
        "code": "U+1F623",
        "browser": "😣",
        "shortname": "persevering face"
      },
      {
        "number": 82,
        "code": "U+1F61E",
        "browser": "😞",
        "shortname": "disappointed face"
      },
      {
        "number": 83,
        "code": "U+1F613",
        "browser": "😓",
        "shortname": "downcast face with sweat"
      },
      {
        "number": 84,
        "code": "U+1F629",
        "browser": "😩",
        "shortname": "weary face"
      },
      {
        "number": 85,
        "code": "U+1F62B",
        "browser": "😫",
        "shortname": "tired face"
      },
      {
        "number": 87,
        "code": "U+1F624",
        "browser": "😤",
        "shortname": "face with steam from nose"
      },
      {
        "number": 88,
        "code": "U+1F621",
        "browser": "😡",
        "shortname": "pouting face"
      },
      {
        "number": 89,
        "code": "U+1F620",
        "browser": "😠",
        "shortname": "angry face"
      },
      {
        "number": 91,
        "code": "U+1F608",
        "browser": "😈",
        "shortname": "smiling face with horns"
      },
      {
        "number": 92,
        "code": "U+1F47F",
        "browser": "👿",
        "shortname": "angry face with horns"
      },
      {
        "number": 93,
        "code": "U+1F480",
        "browser": "💀",
        "shortname": "skull"
      },
      {
        "number": 94,
        "code": "U+2620",
        "browser": "☠",
        "shortname": "skull and crossbones"
      },
      {
        "number": 95,
        "code": "U+1F4A9",
        "browser": "💩",
        "shortname": "pile of poo"
      },
      {
        "number": 96,
        "code": "U+1F921",
        "browser": "🤡",
        "shortname": "clown face"
      },
      {
        "number": 97,
        "code": "U+1F479",
        "browser": "👹",
        "shortname": "ogre"
      },
      {
        "number": 98,
        "code": "U+1F47A",
        "browser": "👺",
        "shortname": "goblin"
      },
      {
        "number": 99,
        "code": "U+1F47B",
        "browser": "👻",
        "shortname": "ghost"
      },
      {
        "number": 100,
        "code": "U+1F47D",
        "browser": "👽",
        "shortname": "alien"
      },
      {
        "number": 101,
        "code": "U+1F47E",
        "browser": "👾",
        "shortname": "alien monster"
      },
      {
        "number": 102,
        "code": "U+1F916",
        "browser": "🤖",
        "shortname": "robot"
      },
      {
        "number": 103,
        "code": "U+1F63A",
        "browser": "😺",
        "shortname": "grinning cat"
      },
      {
        "number": 104,
        "code": "U+1F638",
        "browser": "😸",
        "shortname": "grinning cat with smiling eyes"
      },
      {
        "number": 105,
        "code": "U+1F639",
        "browser": "😹",
        "shortname": "cat with tears of joy"
      },
      {
        "number": 106,
        "code": "U+1F63B",
        "browser": "😻",
        "shortname": "smiling cat with heart-eyes"
      },
      {
        "number": 107,
        "code": "U+1F63C",
        "browser": "😼",
        "shortname": "cat with wry smile"
      },
      {
        "number": 108,
        "code": "U+1F63D",
        "browser": "😽",
        "shortname": "kissing cat"
      },
      {
        "number": 109,
        "code": "U+1F640",
        "browser": "🙀",
        "shortname": "weary cat"
      },
      {
        "number": 110,
        "code": "U+1F63F",
        "browser": "😿",
        "shortname": "crying cat"
      },
      {
        "number": 111,
        "code": "U+1F63E",
        "browser": "😾",
        "shortname": "pouting cat"
      },
      {
        "number": 112,
        "code": "U+1F648",
        "browser": "🙈",
        "shortname": "see-no-evil monkey"
      },
      {
        "number": 113,
        "code": "U+1F649",
        "browser": "🙉",
        "shortname": "hear-no-evil monkey"
      },
      {
        "number": 114,
        "code": "U+1F64A",
        "browser": "🙊",
        "shortname": "speak-no-evil monkey"
      },
      {
        "number": 115,
        "code": "U+1F48B",
        "browser": "💋",
        "shortname": "kiss mark"
      },
      {
        "number": 116,
        "code": "U+1F48C",
        "browser": "💌",
        "shortname": "love letter"
      },
      {
        "number": 117,
        "code": "U+1F498",
        "browser": "💘",
        "shortname": "heart with arrow"
      },
      {
        "number": 118,
        "code": "U+1F49D",
        "browser": "💝",
        "shortname": "heart with ribbon"
      },
      {
        "number": 119,
        "code": "U+1F496",
        "browser": "💖",
        "shortname": "sparkling heart"
      },
      {
        "number": 120,
        "code": "U+1F497",
        "browser": "💗",
        "shortname": "growing heart"
      },
      {
        "number": 121,
        "code": "U+1F493",
        "browser": "💓",
        "shortname": "beating heart"
      },
      {
        "number": 122,
        "code": "U+1F49E",
        "browser": "💞",
        "shortname": "revolving hearts"
      },
      {
        "number": 123,
        "code": "U+1F495",
        "browser": "💕",
        "shortname": "two hearts"
      },
      {
        "number": 124,
        "code": "U+1F49F",
        "browser": "💟",
        "shortname": "heart decoration"
      },
      {
        "number": 125,
        "code": "U+2763",
        "browser": "❣",
        "shortname": "heart exclamation"
      },
      {
        "number": 126,
        "code": "U+1F494",
        "browser": "💔",
        "shortname": "broken heart"
      },
      {
        "number": 127,
        "code": "U+2764",
        "browser": "❤",
        "shortname": "red heart"
      },
      {
        "number": 129,
        "code": "U+1F49B",
        "browser": "💛",
        "shortname": "yellow heart"
      },
      {
        "number": 130,
        "code": "U+1F49A",
        "browser": "💚",
        "shortname": "green heart"
      },
      {
        "number": 131,
        "code": "U+1F499",
        "browser": "💙",
        "shortname": "blue heart"
      },
      {
        "number": 132,
        "code": "U+1F49C",
        "browser": "💜",
        "shortname": "purple heart"
      },
      {
        "number": 134,
        "code": "U+1F5A4",
        "browser": "🖤",
        "shortname": "black heart"
      },
      {
        "number": 136,
        "code": "U+1F4AF",
        "browser": "💯",
        "shortname": "hundred points"
      },
      {
        "number": 137,
        "code": "U+1F4A2",
        "browser": "💢",
        "shortname": "anger symbol"
      },
      {
        "number": 138,
        "code": "U+1F4A5",
        "browser": "💥",
        "shortname": "collision"
      },
      {
        "number": 139,
        "code": "U+1F4AB",
        "browser": "💫",
        "shortname": "dizzy"
      },
      {
        "number": 140,
        "code": "U+1F4A6",
        "browser": "💦",
        "shortname": "sweat droplets"
      },
      {
        "number": 141,
        "code": "U+1F4A8",
        "browser": "💨",
        "shortname": "dashing away"
      },
      {
        "number": 142,
        "code": "U+1F573",
        "browser": "🕳",
        "shortname": "hole"
      },
      {
        "number": 143,
        "code": "U+1F4A3",
        "browser": "💣",
        "shortname": "bomb"
      },
      {
        "number": 144,
        "code": "U+1F4AC",
        "browser": "💬",
        "shortname": "speech balloon"
      },
      {
        "number": 145,
        "code": "U+1F441 U+FE0F U+200D U+1F5E8 U+FE0F",
        "browser": "👁️‍🗨️",
        "shortname": "eye in speech bubble"
      },
      {
        "number": 146,
        "code": "U+1F5E8",
        "browser": "🗨",
        "shortname": "left speech bubble"
      },
      {
        "number": 147,
        "code": "U+1F5EF",
        "browser": "🗯",
        "shortname": "right anger bubble"
      },
      {
        "number": 148,
        "code": "U+1F4AD",
        "browser": "💭",
        "shortname": "thought balloon"
      },
      {
        "number": 149,
        "code": "U+1F4A4",
        "browser": "💤",
        "shortname": "zzz"
      },
      {
        "number": 150,
        "code": "U+1F44B",
        "browser": "👋",
        "shortname": "waving hand"
      },
      {
        "number": 151,
        "code": "U+1F91A",
        "browser": "🤚",
        "shortname": "raised back of hand"
      },
      {
        "number": 152,
        "code": "U+1F590",
        "browser": "🖐",
        "shortname": "hand with fingers splayed"
      },
      {
        "number": 153,
        "code": "U+270B",
        "browser": "✋",
        "shortname": "raised hand"
      },
      {
        "number": 154,
        "code": "U+1F596",
        "browser": "🖖",
        "shortname": "vulcan salute"
      },
      {
        "number": 155,
        "code": "U+1F44C",
        "browser": "👌",
        "shortname": "OK hand"
      },
      {
        "number": 157,
        "code": "U+270C",
        "browser": "✌",
        "shortname": "victory hand"
      },
      {
        "number": 158,
        "code": "U+1F91E",
        "browser": "🤞",
        "shortname": "crossed fingers"
      },
      {
        "number": 160,
        "code": "U+1F918",
        "browser": "🤘",
        "shortname": "sign of the horns"
      },
      {
        "number": 161,
        "code": "U+1F919",
        "browser": "🤙",
        "shortname": "call me hand"
      },
      {
        "number": 162,
        "code": "U+1F448",
        "browser": "👈",
        "shortname": "backhand index pointing left"
      },
      {
        "number": 163,
        "code": "U+1F449",
        "browser": "👉",
        "shortname": "backhand index pointing right"
      },
      {
        "number": 164,
        "code": "U+1F446",
        "browser": "👆",
        "shortname": "backhand index pointing up"
      },
      {
        "number": 165,
        "code": "U+1F595",
        "browser": "🖕",
        "shortname": "middle finger"
      },
      {
        "number": 166,
        "code": "U+1F447",
        "browser": "👇",
        "shortname": "backhand index pointing down"
      },
      {
        "number": 167,
        "code": "U+261D",
        "browser": "☝",
        "shortname": "index pointing up"
      },
      {
        "number": 168,
        "code": "U+1F44D",
        "browser": "👍",
        "shortname": "thumbs up"
      },
      {
        "number": 169,
        "code": "U+1F44E",
        "browser": "👎",
        "shortname": "thumbs down"
      },
      {
        "number": 170,
        "code": "U+270A",
        "browser": "✊",
        "shortname": "raised fist"
      },
      {
        "number": 171,
        "code": "U+1F44A",
        "browser": "👊",
        "shortname": "oncoming fist"
      },
      {
        "number": 172,
        "code": "U+1F91B",
        "browser": "🤛",
        "shortname": "left-facing fist"
      },
      {
        "number": 173,
        "code": "U+1F91C",
        "browser": "🤜",
        "shortname": "right-facing fist"
      },
      {
        "number": 174,
        "code": "U+1F44F",
        "browser": "👏",
        "shortname": "clapping hands"
      },
      {
        "number": 175,
        "code": "U+1F64C",
        "browser": "🙌",
        "shortname": "raising hands"
      },
      {
        "number": 176,
        "code": "U+1F450",
        "browser": "👐",
        "shortname": "open hands"
      },
      {
        "number": 178,
        "code": "U+1F91D",
        "browser": "🤝",
        "shortname": "handshake"
      },
      {
        "number": 179,
        "code": "U+1F64F",
        "browser": "🙏",
        "shortname": "folded hands"
      },
      {
        "number": 180,
        "code": "U+270D",
        "browser": "✍",
        "shortname": "writing hand"
      },
      {
        "number": 181,
        "code": "U+1F485",
        "browser": "💅",
        "shortname": "nail polish"
      },
      {
        "number": 182,
        "code": "U+1F933",
        "browser": "🤳",
        "shortname": "selfie"
      },
      {
        "number": 183,
        "code": "U+1F4AA",
        "browser": "💪",
        "shortname": "flexed biceps"
      },
      {
        "number": 188,
        "code": "U+1F442",
        "browser": "👂",
        "shortname": "ear"
      },
      {
        "number": 190,
        "code": "U+1F443",
        "browser": "👃",
        "shortname": "nose"
      },
      {
        "number": 194,
        "code": "U+1F440",
        "browser": "👀",
        "shortname": "eyes"
      },
      {
        "number": 195,
        "code": "U+1F441",
        "browser": "👁",
        "shortname": "eye"
      },
      {
        "number": 196,
        "code": "U+1F445",
        "browser": "👅",
        "shortname": "tongue"
      },
      {
        "number": 197,
        "code": "U+1F444",
        "browser": "👄",
        "shortname": "mouth"
      },
      {
        "number": 198,
        "code": "U+1F476",
        "browser": "👶",
        "shortname": "baby"
      },
      {
        "number": 200,
        "code": "U+1F466",
        "browser": "👦",
        "shortname": "boy"
      },
      {
        "number": 201,
        "code": "U+1F467",
        "browser": "👧",
        "shortname": "girl"
      },
      {
        "number": 203,
        "code": "U+1F471",
        "browser": "👱",
        "shortname": "person: blond hair"
      },
      {
        "number": 204,
        "code": "U+1F468",
        "browser": "👨",
        "shortname": "man"
      },
      {
        "number": 210,
        "code": "U+1F469",
        "browser": "👩",
        "shortname": "woman"
      },
      {
        "number": 219,
        "code": "U+1F471 U+200D U+2640 U+FE0F",
        "browser": "👱‍♀️",
        "shortname": "woman: blond hair"
      },
      {
        "number": 220,
        "code": "U+1F471 U+200D U+2642 U+FE0F",
        "browser": "👱‍♂️",
        "shortname": "man: blond hair"
      },
      {
        "number": 222,
        "code": "U+1F474",
        "browser": "👴",
        "shortname": "old man"
      },
      {
        "number": 223,
        "code": "U+1F475",
        "browser": "👵",
        "shortname": "old woman"
      },
      {
        "number": 224,
        "code": "U+1F64D",
        "browser": "🙍",
        "shortname": "person frowning"
      },
      {
        "number": 225,
        "code": "U+1F64D U+200D U+2642 U+FE0F",
        "browser": "🙍‍♂️",
        "shortname": "man frowning"
      },
      {
        "number": 226,
        "code": "U+1F64D U+200D U+2640 U+FE0F",
        "browser": "🙍‍♀️",
        "shortname": "woman frowning"
      },
      {
        "number": 227,
        "code": "U+1F64E",
        "browser": "🙎",
        "shortname": "person pouting"
      },
      {
        "number": 228,
        "code": "U+1F64E U+200D U+2642 U+FE0F",
        "browser": "🙎‍♂️",
        "shortname": "man pouting"
      },
      {
        "number": 229,
        "code": "U+1F64E U+200D U+2640 U+FE0F",
        "browser": "🙎‍♀️",
        "shortname": "woman pouting"
      },
      {
        "number": 230,
        "code": "U+1F645",
        "browser": "🙅",
        "shortname": "person gesturing NO"
      },
      {
        "number": 231,
        "code": "U+1F645 U+200D U+2642 U+FE0F",
        "browser": "🙅‍♂️",
        "shortname": "man gesturing NO"
      },
      {
        "number": 232,
        "code": "U+1F645 U+200D U+2640 U+FE0F",
        "browser": "🙅‍♀️",
        "shortname": "woman gesturing NO"
      },
      {
        "number": 233,
        "code": "U+1F646",
        "browser": "🙆",
        "shortname": "person gesturing OK"
      },
      {
        "number": 234,
        "code": "U+1F646 U+200D U+2642 U+FE0F",
        "browser": "🙆‍♂️",
        "shortname": "man gesturing OK"
      },
      {
        "number": 235,
        "code": "U+1F646 U+200D U+2640 U+FE0F",
        "browser": "🙆‍♀️",
        "shortname": "woman gesturing OK"
      },
      {
        "number": 236,
        "code": "U+1F481",
        "browser": "💁",
        "shortname": "person tipping hand"
      },
      {
        "number": 237,
        "code": "U+1F481 U+200D U+2642 U+FE0F",
        "browser": "💁‍♂️",
        "shortname": "man tipping hand"
      },
      {
        "number": 238,
        "code": "U+1F481 U+200D U+2640 U+FE0F",
        "browser": "💁‍♀️",
        "shortname": "woman tipping hand"
      },
      {
        "number": 239,
        "code": "U+1F64B",
        "browser": "🙋",
        "shortname": "person raising hand"
      },
      {
        "number": 240,
        "code": "U+1F64B U+200D U+2642 U+FE0F",
        "browser": "🙋‍♂️",
        "shortname": "man raising hand"
      },
      {
        "number": 241,
        "code": "U+1F64B U+200D U+2640 U+FE0F",
        "browser": "🙋‍♀️",
        "shortname": "woman raising hand"
      },
      {
        "number": 245,
        "code": "U+1F647",
        "browser": "🙇",
        "shortname": "person bowing"
      },
      {
        "number": 246,
        "code": "U+1F647 U+200D U+2642 U+FE0F",
        "browser": "🙇‍♂️",
        "shortname": "man bowing"
      },
      {
        "number": 247,
        "code": "U+1F647 U+200D U+2640 U+FE0F",
        "browser": "🙇‍♀️",
        "shortname": "woman bowing"
      },
      {
        "number": 248,
        "code": "U+1F926",
        "browser": "🤦",
        "shortname": "person facepalming"
      },
      {
        "number": 249,
        "code": "U+1F926 U+200D U+2642 U+FE0F",
        "browser": "🤦‍♂️",
        "shortname": "man facepalming"
      },
      {
        "number": 250,
        "code": "U+1F926 U+200D U+2640 U+FE0F",
        "browser": "🤦‍♀️",
        "shortname": "woman facepalming"
      },
      {
        "number": 251,
        "code": "U+1F937",
        "browser": "🤷",
        "shortname": "person shrugging"
      },
      {
        "number": 252,
        "code": "U+1F937 U+200D U+2642 U+FE0F",
        "browser": "🤷‍♂️",
        "shortname": "man shrugging"
      },
      {
        "number": 253,
        "code": "U+1F937 U+200D U+2640 U+FE0F",
        "browser": "🤷‍♀️",
        "shortname": "woman shrugging"
      },
      {
        "number": 255,
        "code": "U+1F468 U+200D U+2695 U+FE0F",
        "browser": "👨‍⚕️",
        "shortname": "man health worker"
      },
      {
        "number": 256,
        "code": "U+1F469 U+200D U+2695 U+FE0F",
        "browser": "👩‍⚕️",
        "shortname": "woman health worker"
      },
      {
        "number": 258,
        "code": "U+1F468 U+200D U+1F393",
        "browser": "👨‍🎓",
        "shortname": "man student"
      },
      {
        "number": 259,
        "code": "U+1F469 U+200D U+1F393",
        "browser": "👩‍🎓",
        "shortname": "woman student"
      },
      {
        "number": 261,
        "code": "U+1F468 U+200D U+1F3EB",
        "browser": "👨‍🏫",
        "shortname": "man teacher"
      },
      {
        "number": 262,
        "code": "U+1F469 U+200D U+1F3EB",
        "browser": "👩‍🏫",
        "shortname": "woman teacher"
      },
      {
        "number": 264,
        "code": "U+1F468 U+200D U+2696 U+FE0F",
        "browser": "👨‍⚖️",
        "shortname": "man judge"
      },
      {
        "number": 265,
        "code": "U+1F469 U+200D U+2696 U+FE0F",
        "browser": "👩‍⚖️",
        "shortname": "woman judge"
      },
      {
        "number": 267,
        "code": "U+1F468 U+200D U+1F33E",
        "browser": "👨‍🌾",
        "shortname": "man farmer"
      },
      {
        "number": 268,
        "code": "U+1F469 U+200D U+1F33E",
        "browser": "👩‍🌾",
        "shortname": "woman farmer"
      },
      {
        "number": 270,
        "code": "U+1F468 U+200D U+1F373",
        "browser": "👨‍🍳",
        "shortname": "man cook"
      },
      {
        "number": 271,
        "code": "U+1F469 U+200D U+1F373",
        "browser": "👩‍🍳",
        "shortname": "woman cook"
      },
      {
        "number": 273,
        "code": "U+1F468 U+200D U+1F527",
        "browser": "👨‍🔧",
        "shortname": "man mechanic"
      },
      {
        "number": 274,
        "code": "U+1F469 U+200D U+1F527",
        "browser": "👩‍🔧",
        "shortname": "woman mechanic"
      },
      {
        "number": 276,
        "code": "U+1F468 U+200D U+1F3ED",
        "browser": "👨‍🏭",
        "shortname": "man factory worker"
      },
      {
        "number": 277,
        "code": "U+1F469 U+200D U+1F3ED",
        "browser": "👩‍🏭",
        "shortname": "woman factory worker"
      },
      {
        "number": 279,
        "code": "U+1F468 U+200D U+1F4BC",
        "browser": "👨‍💼",
        "shortname": "man office worker"
      },
      {
        "number": 280,
        "code": "U+1F469 U+200D U+1F4BC",
        "browser": "👩‍💼",
        "shortname": "woman office worker"
      },
      {
        "number": 282,
        "code": "U+1F468 U+200D U+1F52C",
        "browser": "👨‍🔬",
        "shortname": "man scientist"
      },
      {
        "number": 283,
        "code": "U+1F469 U+200D U+1F52C",
        "browser": "👩‍🔬",
        "shortname": "woman scientist"
      },
      {
        "number": 285,
        "code": "U+1F468 U+200D U+1F4BB",
        "browser": "👨‍💻",
        "shortname": "man technologist"
      },
      {
        "number": 286,
        "code": "U+1F469 U+200D U+1F4BB",
        "browser": "👩‍💻",
        "shortname": "woman technologist"
      },
      {
        "number": 288,
        "code": "U+1F468 U+200D U+1F3A4",
        "browser": "👨‍🎤",
        "shortname": "man singer"
      },
      {
        "number": 289,
        "code": "U+1F469 U+200D U+1F3A4",
        "browser": "👩‍🎤",
        "shortname": "woman singer"
      },
      {
        "number": 291,
        "code": "U+1F468 U+200D U+1F3A8",
        "browser": "👨‍🎨",
        "shortname": "man artist"
      },
      {
        "number": 292,
        "code": "U+1F469 U+200D U+1F3A8",
        "browser": "👩‍🎨",
        "shortname": "woman artist"
      },
      {
        "number": 294,
        "code": "U+1F468 U+200D U+2708 U+FE0F",
        "browser": "👨‍✈️",
        "shortname": "man pilot"
      },
      {
        "number": 295,
        "code": "U+1F469 U+200D U+2708 U+FE0F",
        "browser": "👩‍✈️",
        "shortname": "woman pilot"
      },
      {
        "number": 297,
        "code": "U+1F468 U+200D U+1F680",
        "browser": "👨‍🚀",
        "shortname": "man astronaut"
      },
      {
        "number": 298,
        "code": "U+1F469 U+200D U+1F680",
        "browser": "👩‍🚀",
        "shortname": "woman astronaut"
      },
      {
        "number": 300,
        "code": "U+1F468 U+200D U+1F692",
        "browser": "👨‍🚒",
        "shortname": "man firefighter"
      },
      {
        "number": 301,
        "code": "U+1F469 U+200D U+1F692",
        "browser": "👩‍🚒",
        "shortname": "woman firefighter"
      },
      {
        "number": 302,
        "code": "U+1F46E",
        "browser": "👮",
        "shortname": "police officer"
      },
      {
        "number": 303,
        "code": "U+1F46E U+200D U+2642 U+FE0F",
        "browser": "👮‍♂️",
        "shortname": "man police officer"
      },
      {
        "number": 304,
        "code": "U+1F46E U+200D U+2640 U+FE0F",
        "browser": "👮‍♀️",
        "shortname": "woman police officer"
      },
      {
        "number": 305,
        "code": "U+1F575",
        "browser": "🕵",
        "shortname": "detective"
      },
      {
        "number": 306,
        "code": "U+1F575 U+FE0F U+200D U+2642 U+FE0F",
        "browser": "🕵️‍♂️",
        "shortname": "man detective"
      },
      {
        "number": 307,
        "code": "U+1F575 U+FE0F U+200D U+2640 U+FE0F",
        "browser": "🕵️‍♀️",
        "shortname": "woman detective"
      },
      {
        "number": 308,
        "code": "U+1F482",
        "browser": "💂",
        "shortname": "guard"
      },
      {
        "number": 309,
        "code": "U+1F482 U+200D U+2642 U+FE0F",
        "browser": "💂‍♂️",
        "shortname": "man guard"
      },
      {
        "number": 310,
        "code": "U+1F482 U+200D U+2640 U+FE0F",
        "browser": "💂‍♀️",
        "shortname": "woman guard"
      },
      {
        "number": 311,
        "code": "U+1F477",
        "browser": "👷",
        "shortname": "construction worker"
      },
      {
        "number": 312,
        "code": "U+1F477 U+200D U+2642 U+FE0F",
        "browser": "👷‍♂️",
        "shortname": "man construction worker"
      },
      {
        "number": 313,
        "code": "U+1F477 U+200D U+2640 U+FE0F",
        "browser": "👷‍♀️",
        "shortname": "woman construction worker"
      },
      {
        "number": 314,
        "code": "U+1F934",
        "browser": "🤴",
        "shortname": "prince"
      },
      {
        "number": 315,
        "code": "U+1F478",
        "browser": "👸",
        "shortname": "princess"
      },
      {
        "number": 316,
        "code": "U+1F473",
        "browser": "👳",
        "shortname": "person wearing turban"
      },
      {
        "number": 317,
        "code": "U+1F473 U+200D U+2642 U+FE0F",
        "browser": "👳‍♂️",
        "shortname": "man wearing turban"
      },
      {
        "number": 318,
        "code": "U+1F473 U+200D U+2640 U+FE0F",
        "browser": "👳‍♀️",
        "shortname": "woman wearing turban"
      },
      {
        "number": 319,
        "code": "U+1F472",
        "browser": "👲",
        "shortname": "person with skullcap"
      },
      {
        "number": 321,
        "code": "U+1F935",
        "browser": "🤵",
        "shortname": "person in tuxedo"
      },
      {
        "number": 322,
        "code": "U+1F470",
        "browser": "👰",
        "shortname": "person with veil"
      },
      {
        "number": 323,
        "code": "U+1F930",
        "browser": "🤰",
        "shortname": "pregnant woman"
      },
      {
        "number": 325,
        "code": "U+1F47C",
        "browser": "👼",
        "shortname": "baby angel"
      },
      {
        "number": 326,
        "code": "U+1F385",
        "browser": "🎅",
        "shortname": "Santa Claus"
      },
      {
        "number": 327,
        "code": "U+1F936",
        "browser": "🤶",
        "shortname": "Mrs. Claus"
      },
      {
        "number": 355,
        "code": "U+1F486",
        "browser": "💆",
        "shortname": "person getting massage"
      },
      {
        "number": 356,
        "code": "U+1F486 U+200D U+2642 U+FE0F",
        "browser": "💆‍♂️",
        "shortname": "man getting massage"
      },
      {
        "number": 357,
        "code": "U+1F486 U+200D U+2640 U+FE0F",
        "browser": "💆‍♀️",
        "shortname": "woman getting massage"
      },
      {
        "number": 358,
        "code": "U+1F487",
        "browser": "💇",
        "shortname": "person getting haircut"
      },
      {
        "number": 359,
        "code": "U+1F487 U+200D U+2642 U+FE0F",
        "browser": "💇‍♂️",
        "shortname": "man getting haircut"
      },
      {
        "number": 360,
        "code": "U+1F487 U+200D U+2640 U+FE0F",
        "browser": "💇‍♀️",
        "shortname": "woman getting haircut"
      },
      {
        "number": 361,
        "code": "U+1F6B6",
        "browser": "🚶",
        "shortname": "person walking"
      },
      {
        "number": 362,
        "code": "U+1F6B6 U+200D U+2642 U+FE0F",
        "browser": "🚶‍♂️",
        "shortname": "man walking"
      },
      {
        "number": 363,
        "code": "U+1F6B6 U+200D U+2640 U+FE0F",
        "browser": "🚶‍♀️",
        "shortname": "woman walking"
      },
      {
        "number": 379,
        "code": "U+1F3C3",
        "browser": "🏃",
        "shortname": "person running"
      },
      {
        "number": 380,
        "code": "U+1F3C3 U+200D U+2642 U+FE0F",
        "browser": "🏃‍♂️",
        "shortname": "man running"
      },
      {
        "number": 381,
        "code": "U+1F3C3 U+200D U+2640 U+FE0F",
        "browser": "🏃‍♀️",
        "shortname": "woman running"
      },
      {
        "number": 382,
        "code": "U+1F483",
        "browser": "💃",
        "shortname": "woman dancing"
      },
      {
        "number": 383,
        "code": "U+1F57A",
        "browser": "🕺",
        "shortname": "man dancing"
      },
      {
        "number": 384,
        "code": "U+1F574",
        "browser": "🕴",
        "shortname": "person in suit levitating"
      },
      {
        "number": 385,
        "code": "U+1F46F",
        "browser": "👯",
        "shortname": "people with bunny ears"
      },
      {
        "number": 386,
        "code": "U+1F46F U+200D U+2642 U+FE0F",
        "browser": "👯‍♂️",
        "shortname": "men with bunny ears"
      },
      {
        "number": 387,
        "code": "U+1F46F U+200D U+2640 U+FE0F",
        "browser": "👯‍♀️",
        "shortname": "women with bunny ears"
      },
      {
        "number": 394,
        "code": "U+1F93A",
        "browser": "🤺",
        "shortname": "person fencing"
      },
      {
        "number": 395,
        "code": "U+1F3C7",
        "browser": "🏇",
        "shortname": "horse racing"
      },
      {
        "number": 396,
        "code": "U+26F7",
        "browser": "⛷",
        "shortname": "skier"
      },
      {
        "number": 397,
        "code": "U+1F3C2",
        "browser": "🏂",
        "shortname": "snowboarder"
      },
      {
        "number": 398,
        "code": "U+1F3CC",
        "browser": "🏌",
        "shortname": "person golfing"
      },
      {
        "number": 399,
        "code": "U+1F3CC U+FE0F U+200D U+2642 U+FE0F",
        "browser": "🏌️‍♂️",
        "shortname": "man golfing"
      },
      {
        "number": 400,
        "code": "U+1F3CC U+FE0F U+200D U+2640 U+FE0F",
        "browser": "🏌️‍♀️",
        "shortname": "woman golfing"
      },
      {
        "number": 401,
        "code": "U+1F3C4",
        "browser": "🏄",
        "shortname": "person surfing"
      },
      {
        "number": 402,
        "code": "U+1F3C4 U+200D U+2642 U+FE0F",
        "browser": "🏄‍♂️",
        "shortname": "man surfing"
      },
      {
        "number": 403,
        "code": "U+1F3C4 U+200D U+2640 U+FE0F",
        "browser": "🏄‍♀️",
        "shortname": "woman surfing"
      },
      {
        "number": 404,
        "code": "U+1F6A3",
        "browser": "🚣",
        "shortname": "person rowing boat"
      },
      {
        "number": 405,
        "code": "U+1F6A3 U+200D U+2642 U+FE0F",
        "browser": "🚣‍♂️",
        "shortname": "man rowing boat"
      },
      {
        "number": 406,
        "code": "U+1F6A3 U+200D U+2640 U+FE0F",
        "browser": "🚣‍♀️",
        "shortname": "woman rowing boat"
      },
      {
        "number": 407,
        "code": "U+1F3CA",
        "browser": "🏊",
        "shortname": "person swimming"
      },
      {
        "number": 408,
        "code": "U+1F3CA U+200D U+2642 U+FE0F",
        "browser": "🏊‍♂️",
        "shortname": "man swimming"
      },
      {
        "number": 409,
        "code": "U+1F3CA U+200D U+2640 U+FE0F",
        "browser": "🏊‍♀️",
        "shortname": "woman swimming"
      },
      {
        "number": 410,
        "code": "U+26F9",
        "browser": "⛹",
        "shortname": "person bouncing ball"
      },
      {
        "number": 411,
        "code": "U+26F9 U+FE0F U+200D U+2642 U+FE0F",
        "browser": "⛹️‍♂️",
        "shortname": "man bouncing ball"
      },
      {
        "number": 412,
        "code": "U+26F9 U+FE0F U+200D U+2640 U+FE0F",
        "browser": "⛹️‍♀️",
        "shortname": "woman bouncing ball"
      },
      {
        "number": 413,
        "code": "U+1F3CB",
        "browser": "🏋",
        "shortname": "person lifting weights"
      },
      {
        "number": 414,
        "code": "U+1F3CB U+FE0F U+200D U+2642 U+FE0F",
        "browser": "🏋️‍♂️",
        "shortname": "man lifting weights"
      },
      {
        "number": 415,
        "code": "U+1F3CB U+FE0F U+200D U+2640 U+FE0F",
        "browser": "🏋️‍♀️",
        "shortname": "woman lifting weights"
      },
      {
        "number": 416,
        "code": "U+1F6B4",
        "browser": "🚴",
        "shortname": "person biking"
      },
      {
        "number": 417,
        "code": "U+1F6B4 U+200D U+2642 U+FE0F",
        "browser": "🚴‍♂️",
        "shortname": "man biking"
      },
      {
        "number": 418,
        "code": "U+1F6B4 U+200D U+2640 U+FE0F",
        "browser": "🚴‍♀️",
        "shortname": "woman biking"
      },
      {
        "number": 419,
        "code": "U+1F6B5",
        "browser": "🚵",
        "shortname": "person mountain biking"
      },
      {
        "number": 420,
        "code": "U+1F6B5 U+200D U+2642 U+FE0F",
        "browser": "🚵‍♂️",
        "shortname": "man mountain biking"
      },
      {
        "number": 421,
        "code": "U+1F6B5 U+200D U+2640 U+FE0F",
        "browser": "🚵‍♀️",
        "shortname": "woman mountain biking"
      },
      {
        "number": 422,
        "code": "U+1F938",
        "browser": "🤸",
        "shortname": "person cartwheeling"
      },
      {
        "number": 423,
        "code": "U+1F938 U+200D U+2642 U+FE0F",
        "browser": "🤸‍♂️",
        "shortname": "man cartwheeling"
      },
      {
        "number": 424,
        "code": "U+1F938 U+200D U+2640 U+FE0F",
        "browser": "🤸‍♀️",
        "shortname": "woman cartwheeling"
      },
      {
        "number": 425,
        "code": "U+1F93C",
        "browser": "🤼",
        "shortname": "people wrestling"
      },
      {
        "number": 426,
        "code": "U+1F93C U+200D U+2642 U+FE0F",
        "browser": "🤼‍♂️",
        "shortname": "men wrestling"
      },
      {
        "number": 427,
        "code": "U+1F93C U+200D U+2640 U+FE0F",
        "browser": "🤼‍♀️",
        "shortname": "women wrestling"
      },
      {
        "number": 428,
        "code": "U+1F93D",
        "browser": "🤽",
        "shortname": "person playing water polo"
      },
      {
        "number": 429,
        "code": "U+1F93D U+200D U+2642 U+FE0F",
        "browser": "🤽‍♂️",
        "shortname": "man playing water polo"
      },
      {
        "number": 430,
        "code": "U+1F93D U+200D U+2640 U+FE0F",
        "browser": "🤽‍♀️",
        "shortname": "woman playing water polo"
      },
      {
        "number": 431,
        "code": "U+1F93E",
        "browser": "🤾",
        "shortname": "person playing handball"
      },
      {
        "number": 432,
        "code": "U+1F93E U+200D U+2642 U+FE0F",
        "browser": "🤾‍♂️",
        "shortname": "man playing handball"
      },
      {
        "number": 433,
        "code": "U+1F93E U+200D U+2640 U+FE0F",
        "browser": "🤾‍♀️",
        "shortname": "woman playing handball"
      },
      {
        "number": 434,
        "code": "U+1F939",
        "browser": "🤹",
        "shortname": "person juggling"
      },
      {
        "number": 435,
        "code": "U+1F939 U+200D U+2642 U+FE0F",
        "browser": "🤹‍♂️",
        "shortname": "man juggling"
      },
      {
        "number": 436,
        "code": "U+1F939 U+200D U+2640 U+FE0F",
        "browser": "🤹‍♀️",
        "shortname": "woman juggling"
      },
      {
        "number": 440,
        "code": "U+1F6C0",
        "browser": "🛀",
        "shortname": "person taking bath"
      },
      {
        "number": 441,
        "code": "U+1F6CC",
        "browser": "🛌",
        "shortname": "person in bed"
      },
      {
        "number": 443,
        "code": "U+1F46D",
        "browser": "👭",
        "shortname": "women holding hands"
      },
      {
        "number": 444,
        "code": "U+1F46B",
        "browser": "👫",
        "shortname": "woman and man holding hands"
      },
      {
        "number": 445,
        "code": "U+1F46C",
        "browser": "👬",
        "shortname": "men holding hands"
      },
      {
        "number": 446,
        "code": "U+1F48F",
        "browser": "💏",
        "shortname": "kiss"
      },
      {
        "number": 447,
        "code": "U+1F469 U+200D U+2764 U+FE0F U+200D U+1F48B U+200D U+1F468",
        "browser": "👩‍❤️‍💋‍👨",
        "shortname": "kiss: woman, man"
      },
      {
        "number": 448,
        "code": "U+1F468 U+200D U+2764 U+FE0F U+200D U+1F48B U+200D U+1F468",
        "browser": "👨‍❤️‍💋‍👨",
        "shortname": "kiss: man, man"
      },
      {
        "number": 449,
        "code": "U+1F469 U+200D U+2764 U+FE0F U+200D U+1F48B U+200D U+1F469",
        "browser": "👩‍❤️‍💋‍👩",
        "shortname": "kiss: woman, woman"
      },
      {
        "number": 450,
        "code": "U+1F491",
        "browser": "💑",
        "shortname": "couple with heart"
      },
      {
        "number": 451,
        "code": "U+1F469 U+200D U+2764 U+FE0F U+200D U+1F468",
        "browser": "👩‍❤️‍👨",
        "shortname": "couple with heart: woman, man"
      },
      {
        "number": 452,
        "code": "U+1F468 U+200D U+2764 U+FE0F U+200D U+1F468",
        "browser": "👨‍❤️‍👨",
        "shortname": "couple with heart: man, man"
      },
      {
        "number": 453,
        "code": "U+1F469 U+200D U+2764 U+FE0F U+200D U+1F469",
        "browser": "👩‍❤️‍👩",
        "shortname": "couple with heart: woman, woman"
      },
      {
        "number": 454,
        "code": "U+1F46A",
        "browser": "👪",
        "shortname": "family"
      },
      {
        "number": 455,
        "code": "U+1F468 U+200D U+1F469 U+200D U+1F466",
        "browser": "👨‍👩‍👦",
        "shortname": "family: man, woman, boy"
      },
      {
        "number": 456,
        "code": "U+1F468 U+200D U+1F469 U+200D U+1F467",
        "browser": "👨‍👩‍👧",
        "shortname": "family: man, woman, girl"
      },
      {
        "number": 457,
        "code": "U+1F468 U+200D U+1F469 U+200D U+1F467 U+200D U+1F466",
        "browser": "👨‍👩‍👧‍👦",
        "shortname": "family: man, woman, girl, boy"
      },
      {
        "number": 458,
        "code": "U+1F468 U+200D U+1F469 U+200D U+1F466 U+200D U+1F466",
        "browser": "👨‍👩‍👦‍👦",
        "shortname": "family: man, woman, boy, boy"
      },
      {
        "number": 459,
        "code": "U+1F468 U+200D U+1F469 U+200D U+1F467 U+200D U+1F467",
        "browser": "👨‍👩‍👧‍👧",
        "shortname": "family: man, woman, girl, girl"
      },
      {
        "number": 460,
        "code": "U+1F468 U+200D U+1F468 U+200D U+1F466",
        "browser": "👨‍👨‍👦",
        "shortname": "family: man, man, boy"
      },
      {
        "number": 461,
        "code": "U+1F468 U+200D U+1F468 U+200D U+1F467",
        "browser": "👨‍👨‍👧",
        "shortname": "family: man, man, girl"
      },
      {
        "number": 462,
        "code": "U+1F468 U+200D U+1F468 U+200D U+1F467 U+200D U+1F466",
        "browser": "👨‍👨‍👧‍👦",
        "shortname": "family: man, man, girl, boy"
      },
      {
        "number": 463,
        "code": "U+1F468 U+200D U+1F468 U+200D U+1F466 U+200D U+1F466",
        "browser": "👨‍👨‍👦‍👦",
        "shortname": "family: man, man, boy, boy"
      },
      {
        "number": 464,
        "code": "U+1F468 U+200D U+1F468 U+200D U+1F467 U+200D U+1F467",
        "browser": "👨‍👨‍👧‍👧",
        "shortname": "family: man, man, girl, girl"
      },
      {
        "number": 465,
        "code": "U+1F469 U+200D U+1F469 U+200D U+1F466",
        "browser": "👩‍👩‍👦",
        "shortname": "family: woman, woman, boy"
      },
      {
        "number": 466,
        "code": "U+1F469 U+200D U+1F469 U+200D U+1F467",
        "browser": "👩‍👩‍👧",
        "shortname": "family: woman, woman, girl"
      },
      {
        "number": 467,
        "code": "U+1F469 U+200D U+1F469 U+200D U+1F467 U+200D U+1F466",
        "browser": "👩‍👩‍👧‍👦",
        "shortname": "family: woman, woman, girl, boy"
      },
      {
        "number": 468,
        "code": "U+1F469 U+200D U+1F469 U+200D U+1F466 U+200D U+1F466",
        "browser": "👩‍👩‍👦‍👦",
        "shortname": "family: woman, woman, boy, boy"
      },
      {
        "number": 469,
        "code": "U+1F469 U+200D U+1F469 U+200D U+1F467 U+200D U+1F467",
        "browser": "👩‍👩‍👧‍👧",
        "shortname": "family: woman, woman, girl, girl"
      },
      {
        "number": 470,
        "code": "U+1F468 U+200D U+1F466",
        "browser": "👨‍👦",
        "shortname": "family: man, boy"
      },
      {
        "number": 471,
        "code": "U+1F468 U+200D U+1F466 U+200D U+1F466",
        "browser": "👨‍👦‍👦",
        "shortname": "family: man, boy, boy"
      },
      {
        "number": 472,
        "code": "U+1F468 U+200D U+1F467",
        "browser": "👨‍👧",
        "shortname": "family: man, girl"
      },
      {
        "number": 473,
        "code": "U+1F468 U+200D U+1F467 U+200D U+1F466",
        "browser": "👨‍👧‍👦",
        "shortname": "family: man, girl, boy"
      },
      {
        "number": 474,
        "code": "U+1F468 U+200D U+1F467 U+200D U+1F467",
        "browser": "👨‍👧‍👧",
        "shortname": "family: man, girl, girl"
      },
      {
        "number": 475,
        "code": "U+1F469 U+200D U+1F466",
        "browser": "👩‍👦",
        "shortname": "family: woman, boy"
      },
      {
        "number": 476,
        "code": "U+1F469 U+200D U+1F466 U+200D U+1F466",
        "browser": "👩‍👦‍👦",
        "shortname": "family: woman, boy, boy"
      },
      {
        "number": 477,
        "code": "U+1F469 U+200D U+1F467",
        "browser": "👩‍👧",
        "shortname": "family: woman, girl"
      },
      {
        "number": 478,
        "code": "U+1F469 U+200D U+1F467 U+200D U+1F466",
        "browser": "👩‍👧‍👦",
        "shortname": "family: woman, girl, boy"
      },
      {
        "number": 479,
        "code": "U+1F469 U+200D U+1F467 U+200D U+1F467",
        "browser": "👩‍👧‍👧",
        "shortname": "family: woman, girl, girl"
      },
      {
        "number": 480,
        "code": "U+1F5E3",
        "browser": "🗣",
        "shortname": "speaking head"
      },
      {
        "number": 481,
        "code": "U+1F464",
        "browser": "👤",
        "shortname": "bust in silhouette"
      },
      {
        "number": 482,
        "code": "U+1F465",
        "browser": "👥",
        "shortname": "busts in silhouette"
      },
      {
        "number": 483,
        "code": "U+1F463",
        "browser": "👣",
        "shortname": "footprints"
      },
      {
        "number": 488,
        "code": "U+1F435",
        "browser": "🐵",
        "shortname": "monkey face"
      },
      {
        "number": 489,
        "code": "U+1F412",
        "browser": "🐒",
        "shortname": "monkey"
      },
      {
        "number": 490,
        "code": "U+1F98D",
        "browser": "🦍",
        "shortname": "gorilla"
      },
      {
        "number": 492,
        "code": "U+1F436",
        "browser": "🐶",
        "shortname": "dog face"
      },
      {
        "number": 493,
        "code": "U+1F415",
        "browser": "🐕",
        "shortname": "dog"
      },
      {
        "number": 496,
        "code": "U+1F429",
        "browser": "🐩",
        "shortname": "poodle"
      },
      {
        "number": 497,
        "code": "U+1F43A",
        "browser": "🐺",
        "shortname": "wolf"
      },
      {
        "number": 498,
        "code": "U+1F98A",
        "browser": "🦊",
        "shortname": "fox"
      },
      {
        "number": 500,
        "code": "U+1F431",
        "browser": "🐱",
        "shortname": "cat face"
      },
      {
        "number": 501,
        "code": "U+1F408",
        "browser": "🐈",
        "shortname": "cat"
      },
      {
        "number": 502,
        "code": "U+1F981",
        "browser": "🦁",
        "shortname": "lion"
      },
      {
        "number": 503,
        "code": "U+1F42F",
        "browser": "🐯",
        "shortname": "tiger face"
      },
      {
        "number": 504,
        "code": "U+1F405",
        "browser": "🐅",
        "shortname": "tiger"
      },
      {
        "number": 505,
        "code": "U+1F406",
        "browser": "🐆",
        "shortname": "leopard"
      },
      {
        "number": 506,
        "code": "U+1F434",
        "browser": "🐴",
        "shortname": "horse face"
      },
      {
        "number": 507,
        "code": "U+1F40E",
        "browser": "🐎",
        "shortname": "horse"
      },
      {
        "number": 508,
        "code": "U+1F984",
        "browser": "🦄",
        "shortname": "unicorn"
      },
      {
        "number": 510,
        "code": "U+1F98C",
        "browser": "🦌",
        "shortname": "deer"
      },
      {
        "number": 511,
        "code": "U+1F42E",
        "browser": "🐮",
        "shortname": "cow face"
      },
      {
        "number": 512,
        "code": "U+1F402",
        "browser": "🐂",
        "shortname": "ox"
      },
      {
        "number": 513,
        "code": "U+1F403",
        "browser": "🐃",
        "shortname": "water buffalo"
      },
      {
        "number": 514,
        "code": "U+1F404",
        "browser": "🐄",
        "shortname": "cow"
      },
      {
        "number": 515,
        "code": "U+1F437",
        "browser": "🐷",
        "shortname": "pig face"
      },
      {
        "number": 516,
        "code": "U+1F416",
        "browser": "🐖",
        "shortname": "pig"
      },
      {
        "number": 517,
        "code": "U+1F417",
        "browser": "🐗",
        "shortname": "boar"
      },
      {
        "number": 518,
        "code": "U+1F43D",
        "browser": "🐽",
        "shortname": "pig nose"
      },
      {
        "number": 519,
        "code": "U+1F40F",
        "browser": "🐏",
        "shortname": "ram"
      },
      {
        "number": 520,
        "code": "U+1F411",
        "browser": "🐑",
        "shortname": "ewe"
      },
      {
        "number": 521,
        "code": "U+1F410",
        "browser": "🐐",
        "shortname": "goat"
      },
      {
        "number": 522,
        "code": "U+1F42A",
        "browser": "🐪",
        "shortname": "camel"
      },
      {
        "number": 523,
        "code": "U+1F42B",
        "browser": "🐫",
        "shortname": "two-hump camel"
      },
      {
        "number": 526,
        "code": "U+1F418",
        "browser": "🐘",
        "shortname": "elephant"
      },
      {
        "number": 527,
        "code": "U+1F98F",
        "browser": "🦏",
        "shortname": "rhinoceros"
      },
      {
        "number": 529,
        "code": "U+1F42D",
        "browser": "🐭",
        "shortname": "mouse face"
      },
      {
        "number": 530,
        "code": "U+1F401",
        "browser": "🐁",
        "shortname": "mouse"
      },
      {
        "number": 531,
        "code": "U+1F400",
        "browser": "🐀",
        "shortname": "rat"
      },
      {
        "number": 532,
        "code": "U+1F439",
        "browser": "🐹",
        "shortname": "hamster"
      },
      {
        "number": 533,
        "code": "U+1F430",
        "browser": "🐰",
        "shortname": "rabbit face"
      },
      {
        "number": 534,
        "code": "U+1F407",
        "browser": "🐇",
        "shortname": "rabbit"
      },
      {
        "number": 535,
        "code": "U+1F43F",
        "browser": "🐿",
        "shortname": "chipmunk"
      },
      {
        "number": 537,
        "code": "U+1F987",
        "browser": "🦇",
        "shortname": "bat"
      },
      {
        "number": 538,
        "code": "U+1F43B",
        "browser": "🐻",
        "shortname": "bear"
      },
      {
        "number": 539,
        "code": "U+1F428",
        "browser": "🐨",
        "shortname": "koala"
      },
      {
        "number": 540,
        "code": "U+1F43C",
        "browser": "🐼",
        "shortname": "panda"
      },
      {
        "number": 546,
        "code": "U+1F43E",
        "browser": "🐾",
        "shortname": "paw prints"
      },
      {
        "number": 547,
        "code": "U+1F983",
        "browser": "🦃",
        "shortname": "turkey"
      },
      {
        "number": 548,
        "code": "U+1F414",
        "browser": "🐔",
        "shortname": "chicken"
      },
      {
        "number": 549,
        "code": "U+1F413",
        "browser": "🐓",
        "shortname": "rooster"
      },
      {
        "number": 550,
        "code": "U+1F423",
        "browser": "🐣",
        "shortname": "hatching chick"
      },
      {
        "number": 551,
        "code": "U+1F424",
        "browser": "🐤",
        "shortname": "baby chick"
      },
      {
        "number": 552,
        "code": "U+1F425",
        "browser": "🐥",
        "shortname": "front-facing baby chick"
      },
      {
        "number": 553,
        "code": "U+1F426",
        "browser": "🐦",
        "shortname": "bird"
      },
      {
        "number": 554,
        "code": "U+1F427",
        "browser": "🐧",
        "shortname": "penguin"
      },
      {
        "number": 555,
        "code": "U+1F54A",
        "browser": "🕊",
        "shortname": "dove"
      },
      {
        "number": 556,
        "code": "U+1F985",
        "browser": "🦅",
        "shortname": "eagle"
      },
      {
        "number": 557,
        "code": "U+1F986",
        "browser": "🦆",
        "shortname": "duck"
      },
      {
        "number": 559,
        "code": "U+1F989",
        "browser": "🦉",
        "shortname": "owl"
      },
      {
        "number": 563,
        "code": "U+1F438",
        "browser": "🐸",
        "shortname": "frog"
      },
      {
        "number": 564,
        "code": "U+1F40A",
        "browser": "🐊",
        "shortname": "crocodile"
      },
      {
        "number": 565,
        "code": "U+1F422",
        "browser": "🐢",
        "shortname": "turtle"
      },
      {
        "number": 566,
        "code": "U+1F98E",
        "browser": "🦎",
        "shortname": "lizard"
      },
      {
        "number": 567,
        "code": "U+1F40D",
        "browser": "🐍",
        "shortname": "snake"
      },
      {
        "number": 568,
        "code": "U+1F432",
        "browser": "🐲",
        "shortname": "dragon face"
      },
      {
        "number": 569,
        "code": "U+1F409",
        "browser": "🐉",
        "shortname": "dragon"
      },
      {
        "number": 572,
        "code": "U+1F433",
        "browser": "🐳",
        "shortname": "spouting whale"
      },
      {
        "number": 573,
        "code": "U+1F40B",
        "browser": "🐋",
        "shortname": "whale"
      },
      {
        "number": 574,
        "code": "U+1F42C",
        "browser": "🐬",
        "shortname": "dolphin"
      },
      {
        "number": 575,
        "code": "U+1F41F",
        "browser": "🐟",
        "shortname": "fish"
      },
      {
        "number": 576,
        "code": "U+1F420",
        "browser": "🐠",
        "shortname": "tropical fish"
      },
      {
        "number": 577,
        "code": "U+1F421",
        "browser": "🐡",
        "shortname": "blowfish"
      },
      {
        "number": 578,
        "code": "U+1F988",
        "browser": "🦈",
        "shortname": "shark"
      },
      {
        "number": 579,
        "code": "U+1F419",
        "browser": "🐙",
        "shortname": "octopus"
      },
      {
        "number": 580,
        "code": "U+1F41A",
        "browser": "🐚",
        "shortname": "spiral shell"
      },
      {
        "number": 581,
        "code": "U+1F40C",
        "browser": "🐌",
        "shortname": "snail"
      },
      {
        "number": 582,
        "code": "U+1F98B",
        "browser": "🦋",
        "shortname": "butterfly"
      },
      {
        "number": 583,
        "code": "U+1F41B",
        "browser": "🐛",
        "shortname": "bug"
      },
      {
        "number": 584,
        "code": "U+1F41C",
        "browser": "🐜",
        "shortname": "ant"
      },
      {
        "number": 585,
        "code": "U+1F41D",
        "browser": "🐝",
        "shortname": "honeybee"
      },
      {
        "number": 586,
        "code": "U+1F41E",
        "browser": "🐞",
        "shortname": "lady beetle"
      },
      {
        "number": 588,
        "code": "U+1F577",
        "browser": "🕷",
        "shortname": "spider"
      },
      {
        "number": 589,
        "code": "U+1F578",
        "browser": "🕸",
        "shortname": "spider web"
      },
      {
        "number": 590,
        "code": "U+1F982",
        "browser": "🦂",
        "shortname": "scorpion"
      },
      {
        "number": 593,
        "code": "U+1F490",
        "browser": "💐",
        "shortname": "bouquet"
      },
      {
        "number": 594,
        "code": "U+1F338",
        "browser": "🌸",
        "shortname": "cherry blossom"
      },
      {
        "number": 595,
        "code": "U+1F4AE",
        "browser": "💮",
        "shortname": "white flower"
      },
      {
        "number": 596,
        "code": "U+1F3F5",
        "browser": "🏵",
        "shortname": "rosette"
      },
      {
        "number": 597,
        "code": "U+1F339",
        "browser": "🌹",
        "shortname": "rose"
      },
      {
        "number": 598,
        "code": "U+1F940",
        "browser": "🥀",
        "shortname": "wilted flower"
      },
      {
        "number": 599,
        "code": "U+1F33A",
        "browser": "🌺",
        "shortname": "hibiscus"
      },
      {
        "number": 600,
        "code": "U+1F33B",
        "browser": "🌻",
        "shortname": "sunflower"
      },
      {
        "number": 601,
        "code": "U+1F33C",
        "browser": "🌼",
        "shortname": "blossom"
      },
      {
        "number": 602,
        "code": "U+1F337",
        "browser": "🌷",
        "shortname": "tulip"
      },
      {
        "number": 603,
        "code": "U+1F331",
        "browser": "🌱",
        "shortname": "seedling"
      },
      {
        "number": 604,
        "code": "U+1F332",
        "browser": "🌲",
        "shortname": "evergreen tree"
      },
      {
        "number": 605,
        "code": "U+1F333",
        "browser": "🌳",
        "shortname": "deciduous tree"
      },
      {
        "number": 606,
        "code": "U+1F334",
        "browser": "🌴",
        "shortname": "palm tree"
      },
      {
        "number": 607,
        "code": "U+1F335",
        "browser": "🌵",
        "shortname": "cactus"
      },
      {
        "number": 608,
        "code": "U+1F33E",
        "browser": "🌾",
        "shortname": "sheaf of rice"
      },
      {
        "number": 609,
        "code": "U+1F33F",
        "browser": "🌿",
        "shortname": "herb"
      },
      {
        "number": 610,
        "code": "U+2618",
        "browser": "☘",
        "shortname": "shamrock"
      },
      {
        "number": 611,
        "code": "U+1F340",
        "browser": "🍀",
        "shortname": "four leaf clover"
      },
      {
        "number": 612,
        "code": "U+1F341",
        "browser": "🍁",
        "shortname": "maple leaf"
      },
      {
        "number": 613,
        "code": "U+1F342",
        "browser": "🍂",
        "shortname": "fallen leaf"
      },
      {
        "number": 614,
        "code": "U+1F343",
        "browser": "🍃",
        "shortname": "leaf fluttering in wind"
      },
      {
        "number": 615,
        "code": "U+1F347",
        "browser": "🍇",
        "shortname": "grapes"
      },
      {
        "number": 616,
        "code": "U+1F348",
        "browser": "🍈",
        "shortname": "melon"
      },
      {
        "number": 617,
        "code": "U+1F349",
        "browser": "🍉",
        "shortname": "watermelon"
      },
      {
        "number": 618,
        "code": "U+1F34A",
        "browser": "🍊",
        "shortname": "tangerine"
      },
      {
        "number": 619,
        "code": "U+1F34B",
        "browser": "🍋",
        "shortname": "lemon"
      },
      {
        "number": 620,
        "code": "U+1F34C",
        "browser": "🍌",
        "shortname": "banana"
      },
      {
        "number": 621,
        "code": "U+1F34D",
        "browser": "🍍",
        "shortname": "pineapple"
      },
      {
        "number": 623,
        "code": "U+1F34E",
        "browser": "🍎",
        "shortname": "red apple"
      },
      {
        "number": 624,
        "code": "U+1F34F",
        "browser": "🍏",
        "shortname": "green apple"
      },
      {
        "number": 625,
        "code": "U+1F350",
        "browser": "🍐",
        "shortname": "pear"
      },
      {
        "number": 626,
        "code": "U+1F351",
        "browser": "🍑",
        "shortname": "peach"
      },
      {
        "number": 627,
        "code": "U+1F352",
        "browser": "🍒",
        "shortname": "cherries"
      },
      {
        "number": 628,
        "code": "U+1F353",
        "browser": "🍓",
        "shortname": "strawberry"
      },
      {
        "number": 629,
        "code": "U+1F95D",
        "browser": "🥝",
        "shortname": "kiwi fruit"
      },
      {
        "number": 630,
        "code": "U+1F345",
        "browser": "🍅",
        "shortname": "tomato"
      },
      {
        "number": 632,
        "code": "U+1F951",
        "browser": "🥑",
        "shortname": "avocado"
      },
      {
        "number": 633,
        "code": "U+1F346",
        "browser": "🍆",
        "shortname": "eggplant"
      },
      {
        "number": 634,
        "code": "U+1F954",
        "browser": "🥔",
        "shortname": "potato"
      },
      {
        "number": 635,
        "code": "U+1F955",
        "browser": "🥕",
        "shortname": "carrot"
      },
      {
        "number": 636,
        "code": "U+1F33D",
        "browser": "🌽",
        "shortname": "ear of corn"
      },
      {
        "number": 637,
        "code": "U+1F336",
        "browser": "🌶",
        "shortname": "hot pepper"
      },
      {
        "number": 638,
        "code": "U+1F952",
        "browser": "🥒",
        "shortname": "cucumber"
      },
      {
        "number": 643,
        "code": "U+1F344",
        "browser": "🍄",
        "shortname": "mushroom"
      },
      {
        "number": 644,
        "code": "U+1F95C",
        "browser": "🥜",
        "shortname": "peanuts"
      },
      {
        "number": 645,
        "code": "U+1F330",
        "browser": "🌰",
        "shortname": "chestnut"
      },
      {
        "number": 646,
        "code": "U+1F35E",
        "browser": "🍞",
        "shortname": "bread"
      },
      {
        "number": 647,
        "code": "U+1F950",
        "browser": "🥐",
        "shortname": "croissant"
      },
      {
        "number": 648,
        "code": "U+1F956",
        "browser": "🥖",
        "shortname": "baguette bread"
      },
      {
        "number": 651,
        "code": "U+1F95E",
        "browser": "🥞",
        "shortname": "pancakes"
      },
      {
        "number": 653,
        "code": "U+1F9C0",
        "browser": "🧀",
        "shortname": "cheese wedge"
      },
      {
        "number": 654,
        "code": "U+1F356",
        "browser": "🍖",
        "shortname": "meat on bone"
      },
      {
        "number": 655,
        "code": "U+1F357",
        "browser": "🍗",
        "shortname": "poultry leg"
      },
      {
        "number": 657,
        "code": "U+1F953",
        "browser": "🥓",
        "shortname": "bacon"
      },
      {
        "number": 658,
        "code": "U+1F354",
        "browser": "🍔",
        "shortname": "hamburger"
      },
      {
        "number": 659,
        "code": "U+1F35F",
        "browser": "🍟",
        "shortname": "french fries"
      },
      {
        "number": 660,
        "code": "U+1F355",
        "browser": "🍕",
        "shortname": "pizza"
      },
      {
        "number": 661,
        "code": "U+1F32D",
        "browser": "🌭",
        "shortname": "hot dog"
      },
      {
        "number": 663,
        "code": "U+1F32E",
        "browser": "🌮",
        "shortname": "taco"
      },
      {
        "number": 664,
        "code": "U+1F32F",
        "browser": "🌯",
        "shortname": "burrito"
      },
      {
        "number": 665,
        "code": "U+1F959",
        "browser": "🥙",
        "shortname": "stuffed flatbread"
      },
      {
        "number": 667,
        "code": "U+1F95A",
        "browser": "🥚",
        "shortname": "egg"
      },
      {
        "number": 668,
        "code": "U+1F373",
        "browser": "🍳",
        "shortname": "cooking"
      },
      {
        "number": 669,
        "code": "U+1F958",
        "browser": "🥘",
        "shortname": "shallow pan of food"
      },
      {
        "number": 670,
        "code": "U+1F372",
        "browser": "🍲",
        "shortname": "pot of food"
      },
      {
        "number": 672,
        "code": "U+1F957",
        "browser": "🥗",
        "shortname": "green salad"
      },
      {
        "number": 673,
        "code": "U+1F37F",
        "browser": "🍿",
        "shortname": "popcorn"
      },
      {
        "number": 677,
        "code": "U+1F371",
        "browser": "🍱",
        "shortname": "bento box"
      },
      {
        "number": 678,
        "code": "U+1F358",
        "browser": "🍘",
        "shortname": "rice cracker"
      },
      {
        "number": 679,
        "code": "U+1F359",
        "browser": "🍙",
        "shortname": "rice ball"
      },
      {
        "number": 680,
        "code": "U+1F35A",
        "browser": "🍚",
        "shortname": "cooked rice"
      },
      {
        "number": 681,
        "code": "U+1F35B",
        "browser": "🍛",
        "shortname": "curry rice"
      },
      {
        "number": 682,
        "code": "U+1F35C",
        "browser": "🍜",
        "shortname": "steaming bowl"
      },
      {
        "number": 683,
        "code": "U+1F35D",
        "browser": "🍝",
        "shortname": "spaghetti"
      },
      {
        "number": 684,
        "code": "U+1F360",
        "browser": "🍠",
        "shortname": "roasted sweet potato"
      },
      {
        "number": 685,
        "code": "U+1F362",
        "browser": "🍢",
        "shortname": "oden"
      },
      {
        "number": 686,
        "code": "U+1F363",
        "browser": "🍣",
        "shortname": "sushi"
      },
      {
        "number": 687,
        "code": "U+1F364",
        "browser": "🍤",
        "shortname": "fried shrimp"
      },
      {
        "number": 688,
        "code": "U+1F365",
        "browser": "🍥",
        "shortname": "fish cake with swirl"
      },
      {
        "number": 690,
        "code": "U+1F361",
        "browser": "🍡",
        "shortname": "dango"
      },
      {
        "number": 694,
        "code": "U+1F980",
        "browser": "🦀",
        "shortname": "crab"
      },
      {
        "number": 696,
        "code": "U+1F990",
        "browser": "🦐",
        "shortname": "shrimp"
      },
      {
        "number": 697,
        "code": "U+1F991",
        "browser": "🦑",
        "shortname": "squid"
      },
      {
        "number": 699,
        "code": "U+1F366",
        "browser": "🍦",
        "shortname": "soft ice cream"
      },
      {
        "number": 700,
        "code": "U+1F367",
        "browser": "🍧",
        "shortname": "shaved ice"
      },
      {
        "number": 701,
        "code": "U+1F368",
        "browser": "🍨",
        "shortname": "ice cream"
      },
      {
        "number": 702,
        "code": "U+1F369",
        "browser": "🍩",
        "shortname": "doughnut"
      },
      {
        "number": 703,
        "code": "U+1F36A",
        "browser": "🍪",
        "shortname": "cookie"
      },
      {
        "number": 704,
        "code": "U+1F382",
        "browser": "🎂",
        "shortname": "birthday cake"
      },
      {
        "number": 705,
        "code": "U+1F370",
        "browser": "🍰",
        "shortname": "shortcake"
      },
      {
        "number": 708,
        "code": "U+1F36B",
        "browser": "🍫",
        "shortname": "chocolate bar"
      },
      {
        "number": 709,
        "code": "U+1F36C",
        "browser": "🍬",
        "shortname": "candy"
      },
      {
        "number": 710,
        "code": "U+1F36D",
        "browser": "🍭",
        "shortname": "lollipop"
      },
      {
        "number": 711,
        "code": "U+1F36E",
        "browser": "🍮",
        "shortname": "custard"
      },
      {
        "number": 712,
        "code": "U+1F36F",
        "browser": "🍯",
        "shortname": "honey pot"
      },
      {
        "number": 713,
        "code": "U+1F37C",
        "browser": "🍼",
        "shortname": "baby bottle"
      },
      {
        "number": 714,
        "code": "U+1F95B",
        "browser": "🥛",
        "shortname": "glass of milk"
      },
      {
        "number": 715,
        "code": "U+2615",
        "browser": "☕",
        "shortname": "hot beverage"
      },
      {
        "number": 716,
        "code": "U+1F375",
        "browser": "🍵",
        "shortname": "teacup without handle"
      },
      {
        "number": 717,
        "code": "U+1F376",
        "browser": "🍶",
        "shortname": "sake"
      },
      {
        "number": 718,
        "code": "U+1F37E",
        "browser": "🍾",
        "shortname": "bottle with popping cork"
      },
      {
        "number": 719,
        "code": "U+1F377",
        "browser": "🍷",
        "shortname": "wine glass"
      },
      {
        "number": 720,
        "code": "U+1F378",
        "browser": "🍸",
        "shortname": "cocktail glass"
      },
      {
        "number": 721,
        "code": "U+1F379",
        "browser": "🍹",
        "shortname": "tropical drink"
      },
      {
        "number": 722,
        "code": "U+1F37A",
        "browser": "🍺",
        "shortname": "beer mug"
      },
      {
        "number": 723,
        "code": "U+1F37B",
        "browser": "🍻",
        "shortname": "clinking beer mugs"
      },
      {
        "number": 724,
        "code": "U+1F942",
        "browser": "🥂",
        "shortname": "clinking glasses"
      },
      {
        "number": 725,
        "code": "U+1F943",
        "browser": "🥃",
        "shortname": "tumbler glass"
      },
      {
        "number": 731,
        "code": "U+1F37D",
        "browser": "🍽",
        "shortname": "fork and knife with plate"
      },
      {
        "number": 732,
        "code": "U+1F374",
        "browser": "🍴",
        "shortname": "fork and knife"
      },
      {
        "number": 733,
        "code": "U+1F944",
        "browser": "🥄",
        "shortname": "spoon"
      },
      {
        "number": 734,
        "code": "U+1F52A",
        "browser": "🔪",
        "shortname": "kitchen knife"
      },
      {
        "number": 735,
        "code": "U+1F3FA",
        "browser": "🏺",
        "shortname": "amphora"
      },
      {
        "number": 736,
        "code": "U+1F30D",
        "browser": "🌍",
        "shortname": "globe showing Europe-Africa"
      },
      {
        "number": 737,
        "code": "U+1F30E",
        "browser": "🌎",
        "shortname": "globe showing Americas"
      },
      {
        "number": 738,
        "code": "U+1F30F",
        "browser": "🌏",
        "shortname": "globe showing Asia-Australia"
      },
      {
        "number": 739,
        "code": "U+1F310",
        "browser": "🌐",
        "shortname": "globe with meridians"
      },
      {
        "number": 740,
        "code": "U+1F5FA",
        "browser": "🗺",
        "shortname": "world map"
      },
      {
        "number": 741,
        "code": "U+1F5FE",
        "browser": "🗾",
        "shortname": "map of Japan"
      },
      {
        "number": 743,
        "code": "U+1F3D4",
        "browser": "🏔",
        "shortname": "snow-capped mountain"
      },
      {
        "number": 744,
        "code": "U+26F0",
        "browser": "⛰",
        "shortname": "mountain"
      },
      {
        "number": 745,
        "code": "U+1F30B",
        "browser": "🌋",
        "shortname": "volcano"
      },
      {
        "number": 746,
        "code": "U+1F5FB",
        "browser": "🗻",
        "shortname": "mount fuji"
      },
      {
        "number": 747,
        "code": "U+1F3D5",
        "browser": "🏕",
        "shortname": "camping"
      },
      {
        "number": 748,
        "code": "U+1F3D6",
        "browser": "🏖",
        "shortname": "beach with umbrella"
      },
      {
        "number": 749,
        "code": "U+1F3DC",
        "browser": "🏜",
        "shortname": "desert"
      },
      {
        "number": 750,
        "code": "U+1F3DD",
        "browser": "🏝",
        "shortname": "desert island"
      },
      {
        "number": 751,
        "code": "U+1F3DE",
        "browser": "🏞",
        "shortname": "national park"
      },
      {
        "number": 752,
        "code": "U+1F3DF",
        "browser": "🏟",
        "shortname": "stadium"
      },
      {
        "number": 753,
        "code": "U+1F3DB",
        "browser": "🏛",
        "shortname": "classical building"
      },
      {
        "number": 754,
        "code": "U+1F3D7",
        "browser": "🏗",
        "shortname": "building construction"
      },
      {
        "number": 756,
        "code": "U+1F3D8",
        "browser": "🏘",
        "shortname": "houses"
      },
      {
        "number": 757,
        "code": "U+1F3DA",
        "browser": "🏚",
        "shortname": "derelict house"
      },
      {
        "number": 758,
        "code": "U+1F3E0",
        "browser": "🏠",
        "shortname": "house"
      },
      {
        "number": 759,
        "code": "U+1F3E1",
        "browser": "🏡",
        "shortname": "house with garden"
      },
      {
        "number": 760,
        "code": "U+1F3E2",
        "browser": "🏢",
        "shortname": "office building"
      },
      {
        "number": 761,
        "code": "U+1F3E3",
        "browser": "🏣",
        "shortname": "Japanese post office"
      },
      {
        "number": 762,
        "code": "U+1F3E4",
        "browser": "🏤",
        "shortname": "post office"
      },
      {
        "number": 763,
        "code": "U+1F3E5",
        "browser": "🏥",
        "shortname": "hospital"
      },
      {
        "number": 764,
        "code": "U+1F3E6",
        "browser": "🏦",
        "shortname": "bank"
      },
      {
        "number": 765,
        "code": "U+1F3E8",
        "browser": "🏨",
        "shortname": "hotel"
      },
      {
        "number": 766,
        "code": "U+1F3E9",
        "browser": "🏩",
        "shortname": "love hotel"
      },
      {
        "number": 767,
        "code": "U+1F3EA",
        "browser": "🏪",
        "shortname": "convenience store"
      },
      {
        "number": 768,
        "code": "U+1F3EB",
        "browser": "🏫",
        "shortname": "school"
      },
      {
        "number": 769,
        "code": "U+1F3EC",
        "browser": "🏬",
        "shortname": "department store"
      },
      {
        "number": 770,
        "code": "U+1F3ED",
        "browser": "🏭",
        "shortname": "factory"
      },
      {
        "number": 771,
        "code": "U+1F3EF",
        "browser": "🏯",
        "shortname": "Japanese castle"
      },
      {
        "number": 772,
        "code": "U+1F3F0",
        "browser": "🏰",
        "shortname": "castle"
      },
      {
        "number": 773,
        "code": "U+1F492",
        "browser": "💒",
        "shortname": "wedding"
      },
      {
        "number": 774,
        "code": "U+1F5FC",
        "browser": "🗼",
        "shortname": "Tokyo tower"
      },
      {
        "number": 775,
        "code": "U+1F5FD",
        "browser": "🗽",
        "shortname": "Statue of Liberty"
      },
      {
        "number": 776,
        "code": "U+26EA",
        "browser": "⛪",
        "shortname": "church"
      },
      {
        "number": 777,
        "code": "U+1F54C",
        "browser": "🕌",
        "shortname": "mosque"
      },
      {
        "number": 779,
        "code": "U+1F54D",
        "browser": "🕍",
        "shortname": "synagogue"
      },
      {
        "number": 780,
        "code": "U+26E9",
        "browser": "⛩",
        "shortname": "shinto shrine"
      },
      {
        "number": 781,
        "code": "U+1F54B",
        "browser": "🕋",
        "shortname": "kaaba"
      },
      {
        "number": 782,
        "code": "U+26F2",
        "browser": "⛲",
        "shortname": "fountain"
      },
      {
        "number": 783,
        "code": "U+26FA",
        "browser": "⛺",
        "shortname": "tent"
      },
      {
        "number": 784,
        "code": "U+1F301",
        "browser": "🌁",
        "shortname": "foggy"
      },
      {
        "number": 785,
        "code": "U+1F303",
        "browser": "🌃",
        "shortname": "night with stars"
      },
      {
        "number": 786,
        "code": "U+1F3D9",
        "browser": "🏙",
        "shortname": "cityscape"
      },
      {
        "number": 787,
        "code": "U+1F304",
        "browser": "🌄",
        "shortname": "sunrise over mountains"
      },
      {
        "number": 788,
        "code": "U+1F305",
        "browser": "🌅",
        "shortname": "sunrise"
      },
      {
        "number": 789,
        "code": "U+1F306",
        "browser": "🌆",
        "shortname": "cityscape at dusk"
      },
      {
        "number": 790,
        "code": "U+1F307",
        "browser": "🌇",
        "shortname": "sunset"
      },
      {
        "number": 791,
        "code": "U+1F309",
        "browser": "🌉",
        "shortname": "bridge at night"
      },
      {
        "number": 792,
        "code": "U+2668",
        "browser": "♨",
        "shortname": "hot springs"
      },
      {
        "number": 793,
        "code": "U+1F3A0",
        "browser": "🎠",
        "shortname": "carousel horse"
      },
      {
        "number": 794,
        "code": "U+1F3A1",
        "browser": "🎡",
        "shortname": "ferris wheel"
      },
      {
        "number": 795,
        "code": "U+1F3A2",
        "browser": "🎢",
        "shortname": "roller coaster"
      },
      {
        "number": 796,
        "code": "U+1F488",
        "browser": "💈",
        "shortname": "barber pole"
      },
      {
        "number": 797,
        "code": "U+1F3AA",
        "browser": "🎪",
        "shortname": "circus tent"
      },
      {
        "number": 798,
        "code": "U+1F682",
        "browser": "🚂",
        "shortname": "locomotive"
      },
      {
        "number": 799,
        "code": "U+1F683",
        "browser": "🚃",
        "shortname": "railway car"
      },
      {
        "number": 800,
        "code": "U+1F684",
        "browser": "🚄",
        "shortname": "high-speed train"
      },
      {
        "number": 801,
        "code": "U+1F685",
        "browser": "🚅",
        "shortname": "bullet train"
      },
      {
        "number": 802,
        "code": "U+1F686",
        "browser": "🚆",
        "shortname": "train"
      },
      {
        "number": 803,
        "code": "U+1F687",
        "browser": "🚇",
        "shortname": "metro"
      },
      {
        "number": 804,
        "code": "U+1F688",
        "browser": "🚈",
        "shortname": "light rail"
      },
      {
        "number": 805,
        "code": "U+1F689",
        "browser": "🚉",
        "shortname": "station"
      },
      {
        "number": 806,
        "code": "U+1F68A",
        "browser": "🚊",
        "shortname": "tram"
      },
      {
        "number": 807,
        "code": "U+1F69D",
        "browser": "🚝",
        "shortname": "monorail"
      },
      {
        "number": 808,
        "code": "U+1F69E",
        "browser": "🚞",
        "shortname": "mountain railway"
      },
      {
        "number": 809,
        "code": "U+1F68B",
        "browser": "🚋",
        "shortname": "tram car"
      },
      {
        "number": 810,
        "code": "U+1F68C",
        "browser": "🚌",
        "shortname": "bus"
      },
      {
        "number": 811,
        "code": "U+1F68D",
        "browser": "🚍",
        "shortname": "oncoming bus"
      },
      {
        "number": 812,
        "code": "U+1F68E",
        "browser": "🚎",
        "shortname": "trolleybus"
      },
      {
        "number": 813,
        "code": "U+1F690",
        "browser": "🚐",
        "shortname": "minibus"
      },
      {
        "number": 814,
        "code": "U+1F691",
        "browser": "🚑",
        "shortname": "ambulance"
      },
      {
        "number": 815,
        "code": "U+1F692",
        "browser": "🚒",
        "shortname": "fire engine"
      },
      {
        "number": 816,
        "code": "U+1F693",
        "browser": "🚓",
        "shortname": "police car"
      },
      {
        "number": 817,
        "code": "U+1F694",
        "browser": "🚔",
        "shortname": "oncoming police car"
      },
      {
        "number": 818,
        "code": "U+1F695",
        "browser": "🚕",
        "shortname": "taxi"
      },
      {
        "number": 819,
        "code": "U+1F696",
        "browser": "🚖",
        "shortname": "oncoming taxi"
      },
      {
        "number": 820,
        "code": "U+1F697",
        "browser": "🚗",
        "shortname": "automobile"
      },
      {
        "number": 821,
        "code": "U+1F698",
        "browser": "🚘",
        "shortname": "oncoming automobile"
      },
      {
        "number": 822,
        "code": "U+1F699",
        "browser": "🚙",
        "shortname": "sport utility vehicle"
      },
      {
        "number": 823,
        "code": "U+1F69A",
        "browser": "🚚",
        "shortname": "delivery truck"
      },
      {
        "number": 824,
        "code": "U+1F69B",
        "browser": "🚛",
        "shortname": "articulated lorry"
      },
      {
        "number": 825,
        "code": "U+1F69C",
        "browser": "🚜",
        "shortname": "tractor"
      },
      {
        "number": 826,
        "code": "U+1F3CE",
        "browser": "🏎",
        "shortname": "racing car"
      },
      {
        "number": 827,
        "code": "U+1F3CD",
        "browser": "🏍",
        "shortname": "motorcycle"
      },
      {
        "number": 828,
        "code": "U+1F6F5",
        "browser": "🛵",
        "shortname": "motor scooter"
      },
      {
        "number": 832,
        "code": "U+1F6B2",
        "browser": "🚲",
        "shortname": "bicycle"
      },
      {
        "number": 833,
        "code": "U+1F6F4",
        "browser": "🛴",
        "shortname": "kick scooter"
      },
      {
        "number": 835,
        "code": "U+1F68F",
        "browser": "🚏",
        "shortname": "bus stop"
      },
      {
        "number": 836,
        "code": "U+1F6E3",
        "browser": "🛣",
        "shortname": "motorway"
      },
      {
        "number": 837,
        "code": "U+1F6E4",
        "browser": "🛤",
        "shortname": "railway track"
      },
      {
        "number": 838,
        "code": "U+1F6E2",
        "browser": "🛢",
        "shortname": "oil drum"
      },
      {
        "number": 839,
        "code": "U+26FD",
        "browser": "⛽",
        "shortname": "fuel pump"
      },
      {
        "number": 840,
        "code": "U+1F6A8",
        "browser": "🚨",
        "shortname": "police car light"
      },
      {
        "number": 841,
        "code": "U+1F6A5",
        "browser": "🚥",
        "shortname": "horizontal traffic light"
      },
      {
        "number": 842,
        "code": "U+1F6A6",
        "browser": "🚦",
        "shortname": "vertical traffic light"
      },
      {
        "number": 843,
        "code": "U+1F6D1",
        "browser": "🛑",
        "shortname": "stop sign"
      },
      {
        "number": 844,
        "code": "U+1F6A7",
        "browser": "🚧",
        "shortname": "construction"
      },
      {
        "number": 845,
        "code": "U+2693",
        "browser": "⚓",
        "shortname": "anchor"
      },
      {
        "number": 846,
        "code": "U+26F5",
        "browser": "⛵",
        "shortname": "sailboat"
      },
      {
        "number": 847,
        "code": "U+1F6F6",
        "browser": "🛶",
        "shortname": "canoe"
      },
      {
        "number": 848,
        "code": "U+1F6A4",
        "browser": "🚤",
        "shortname": "speedboat"
      },
      {
        "number": 849,
        "code": "U+1F6F3",
        "browser": "🛳",
        "shortname": "passenger ship"
      },
      {
        "number": 850,
        "code": "U+26F4",
        "browser": "⛴",
        "shortname": "ferry"
      },
      {
        "number": 851,
        "code": "U+1F6E5",
        "browser": "🛥",
        "shortname": "motor boat"
      },
      {
        "number": 852,
        "code": "U+1F6A2",
        "browser": "🚢",
        "shortname": "ship"
      },
      {
        "number": 853,
        "code": "U+2708",
        "browser": "✈",
        "shortname": "airplane"
      },
      {
        "number": 854,
        "code": "U+1F6E9",
        "browser": "🛩",
        "shortname": "small airplane"
      },
      {
        "number": 855,
        "code": "U+1F6EB",
        "browser": "🛫",
        "shortname": "airplane departure"
      },
      {
        "number": 856,
        "code": "U+1F6EC",
        "browser": "🛬",
        "shortname": "airplane arrival"
      },
      {
        "number": 858,
        "code": "U+1F4BA",
        "browser": "💺",
        "shortname": "seat"
      },
      {
        "number": 859,
        "code": "U+1F681",
        "browser": "🚁",
        "shortname": "helicopter"
      },
      {
        "number": 860,
        "code": "U+1F69F",
        "browser": "🚟",
        "shortname": "suspension railway"
      },
      {
        "number": 861,
        "code": "U+1F6A0",
        "browser": "🚠",
        "shortname": "mountain cableway"
      },
      {
        "number": 862,
        "code": "U+1F6A1",
        "browser": "🚡",
        "shortname": "aerial tramway"
      },
      {
        "number": 863,
        "code": "U+1F6F0",
        "browser": "🛰",
        "shortname": "satellite"
      },
      {
        "number": 864,
        "code": "U+1F680",
        "browser": "🚀",
        "shortname": "rocket"
      },
      {
        "number": 866,
        "code": "U+1F6CE",
        "browser": "🛎",
        "shortname": "bellhop bell"
      },
      {
        "number": 868,
        "code": "U+231B",
        "browser": "⌛",
        "shortname": "hourglass done"
      },
      {
        "number": 869,
        "code": "U+23F3",
        "browser": "⏳",
        "shortname": "hourglass not done"
      },
      {
        "number": 870,
        "code": "U+231A",
        "browser": "⌚",
        "shortname": "watch"
      },
      {
        "number": 871,
        "code": "U+23F0",
        "browser": "⏰",
        "shortname": "alarm clock"
      },
      {
        "number": 872,
        "code": "U+23F1",
        "browser": "⏱",
        "shortname": "stopwatch"
      },
      {
        "number": 873,
        "code": "U+23F2",
        "browser": "⏲",
        "shortname": "timer clock"
      },
      {
        "number": 874,
        "code": "U+1F570",
        "browser": "🕰",
        "shortname": "mantelpiece clock"
      },
      {
        "number": 875,
        "code": "U+1F55B",
        "browser": "🕛",
        "shortname": "twelve o’clock"
      },
      {
        "number": 876,
        "code": "U+1F567",
        "browser": "🕧",
        "shortname": "twelve-thirty"
      },
      {
        "number": 877,
        "code": "U+1F550",
        "browser": "🕐",
        "shortname": "one o’clock"
      },
      {
        "number": 878,
        "code": "U+1F55C",
        "browser": "🕜",
        "shortname": "one-thirty"
      },
      {
        "number": 879,
        "code": "U+1F551",
        "browser": "🕑",
        "shortname": "two o’clock"
      },
      {
        "number": 880,
        "code": "U+1F55D",
        "browser": "🕝",
        "shortname": "two-thirty"
      },
      {
        "number": 881,
        "code": "U+1F552",
        "browser": "🕒",
        "shortname": "three o’clock"
      },
      {
        "number": 882,
        "code": "U+1F55E",
        "browser": "🕞",
        "shortname": "three-thirty"
      },
      {
        "number": 883,
        "code": "U+1F553",
        "browser": "🕓",
        "shortname": "four o’clock"
      },
      {
        "number": 884,
        "code": "U+1F55F",
        "browser": "🕟",
        "shortname": "four-thirty"
      },
      {
        "number": 885,
        "code": "U+1F554",
        "browser": "🕔",
        "shortname": "five o’clock"
      },
      {
        "number": 886,
        "code": "U+1F560",
        "browser": "🕠",
        "shortname": "five-thirty"
      },
      {
        "number": 887,
        "code": "U+1F555",
        "browser": "🕕",
        "shortname": "six o’clock"
      },
      {
        "number": 888,
        "code": "U+1F561",
        "browser": "🕡",
        "shortname": "six-thirty"
      },
      {
        "number": 889,
        "code": "U+1F556",
        "browser": "🕖",
        "shortname": "seven o’clock"
      },
      {
        "number": 890,
        "code": "U+1F562",
        "browser": "🕢",
        "shortname": "seven-thirty"
      },
      {
        "number": 891,
        "code": "U+1F557",
        "browser": "🕗",
        "shortname": "eight o’clock"
      },
      {
        "number": 892,
        "code": "U+1F563",
        "browser": "🕣",
        "shortname": "eight-thirty"
      },
      {
        "number": 893,
        "code": "U+1F558",
        "browser": "🕘",
        "shortname": "nine o’clock"
      },
      {
        "number": 894,
        "code": "U+1F564",
        "browser": "🕤",
        "shortname": "nine-thirty"
      },
      {
        "number": 895,
        "code": "U+1F559",
        "browser": "🕙",
        "shortname": "ten o’clock"
      },
      {
        "number": 896,
        "code": "U+1F565",
        "browser": "🕥",
        "shortname": "ten-thirty"
      },
      {
        "number": 897,
        "code": "U+1F55A",
        "browser": "🕚",
        "shortname": "eleven o’clock"
      },
      {
        "number": 898,
        "code": "U+1F566",
        "browser": "🕦",
        "shortname": "eleven-thirty"
      },
      {
        "number": 899,
        "code": "U+1F311",
        "browser": "🌑",
        "shortname": "new moon"
      },
      {
        "number": 900,
        "code": "U+1F312",
        "browser": "🌒",
        "shortname": "waxing crescent moon"
      },
      {
        "number": 901,
        "code": "U+1F313",
        "browser": "🌓",
        "shortname": "first quarter moon"
      },
      {
        "number": 902,
        "code": "U+1F314",
        "browser": "🌔",
        "shortname": "waxing gibbous moon"
      },
      {
        "number": 903,
        "code": "U+1F315",
        "browser": "🌕",
        "shortname": "full moon"
      },
      {
        "number": 904,
        "code": "U+1F316",
        "browser": "🌖",
        "shortname": "waning gibbous moon"
      },
      {
        "number": 905,
        "code": "U+1F317",
        "browser": "🌗",
        "shortname": "last quarter moon"
      },
      {
        "number": 906,
        "code": "U+1F318",
        "browser": "🌘",
        "shortname": "waning crescent moon"
      },
      {
        "number": 907,
        "code": "U+1F319",
        "browser": "🌙",
        "shortname": "crescent moon"
      },
      {
        "number": 908,
        "code": "U+1F31A",
        "browser": "🌚",
        "shortname": "new moon face"
      },
      {
        "number": 909,
        "code": "U+1F31B",
        "browser": "🌛",
        "shortname": "first quarter moon face"
      },
      {
        "number": 910,
        "code": "U+1F31C",
        "browser": "🌜",
        "shortname": "last quarter moon face"
      },
      {
        "number": 911,
        "code": "U+1F321",
        "browser": "🌡",
        "shortname": "thermometer"
      },
      {
        "number": 912,
        "code": "U+2600",
        "browser": "☀",
        "shortname": "sun"
      },
      {
        "number": 913,
        "code": "U+1F31D",
        "browser": "🌝",
        "shortname": "full moon face"
      },
      {
        "number": 914,
        "code": "U+1F31E",
        "browser": "🌞",
        "shortname": "sun with face"
      },
      {
        "number": 916,
        "code": "U+2B50",
        "browser": "⭐",
        "shortname": "star"
      },
      {
        "number": 917,
        "code": "U+1F31F",
        "browser": "🌟",
        "shortname": "glowing star"
      },
      {
        "number": 918,
        "code": "U+1F320",
        "browser": "🌠",
        "shortname": "shooting star"
      },
      {
        "number": 919,
        "code": "U+1F30C",
        "browser": "🌌",
        "shortname": "milky way"
      },
      {
        "number": 920,
        "code": "U+2601",
        "browser": "☁",
        "shortname": "cloud"
      },
      {
        "number": 921,
        "code": "U+26C5",
        "browser": "⛅",
        "shortname": "sun behind cloud"
      },
      {
        "number": 922,
        "code": "U+26C8",
        "browser": "⛈",
        "shortname": "cloud with lightning and rain"
      },
      {
        "number": 923,
        "code": "U+1F324",
        "browser": "🌤",
        "shortname": "sun behind small cloud"
      },
      {
        "number": 924,
        "code": "U+1F325",
        "browser": "🌥",
        "shortname": "sun behind large cloud"
      },
      {
        "number": 925,
        "code": "U+1F326",
        "browser": "🌦",
        "shortname": "sun behind rain cloud"
      },
      {
        "number": 926,
        "code": "U+1F327",
        "browser": "🌧",
        "shortname": "cloud with rain"
      },
      {
        "number": 927,
        "code": "U+1F328",
        "browser": "🌨",
        "shortname": "cloud with snow"
      },
      {
        "number": 928,
        "code": "U+1F329",
        "browser": "🌩",
        "shortname": "cloud with lightning"
      },
      {
        "number": 929,
        "code": "U+1F32A",
        "browser": "🌪",
        "shortname": "tornado"
      },
      {
        "number": 930,
        "code": "U+1F32B",
        "browser": "🌫",
        "shortname": "fog"
      },
      {
        "number": 931,
        "code": "U+1F32C",
        "browser": "🌬",
        "shortname": "wind face"
      },
      {
        "number": 932,
        "code": "U+1F300",
        "browser": "🌀",
        "shortname": "cyclone"
      },
      {
        "number": 933,
        "code": "U+1F308",
        "browser": "🌈",
        "shortname": "rainbow"
      },
      {
        "number": 934,
        "code": "U+1F302",
        "browser": "🌂",
        "shortname": "closed umbrella"
      },
      {
        "number": 935,
        "code": "U+2602",
        "browser": "☂",
        "shortname": "umbrella"
      },
      {
        "number": 936,
        "code": "U+2614",
        "browser": "☔",
        "shortname": "umbrella with rain drops"
      },
      {
        "number": 937,
        "code": "U+26F1",
        "browser": "⛱",
        "shortname": "umbrella on ground"
      },
      {
        "number": 938,
        "code": "U+26A1",
        "browser": "⚡",
        "shortname": "high voltage"
      },
      {
        "number": 939,
        "code": "U+2744",
        "browser": "❄",
        "shortname": "snowflake"
      },
      {
        "number": 940,
        "code": "U+2603",
        "browser": "☃",
        "shortname": "snowman"
      },
      {
        "number": 941,
        "code": "U+26C4",
        "browser": "⛄",
        "shortname": "snowman without snow"
      },
      {
        "number": 942,
        "code": "U+2604",
        "browser": "☄",
        "shortname": "comet"
      },
      {
        "number": 943,
        "code": "U+1F525",
        "browser": "🔥",
        "shortname": "fire"
      },
      {
        "number": 944,
        "code": "U+1F4A7",
        "browser": "💧",
        "shortname": "droplet"
      },
      {
        "number": 945,
        "code": "U+1F30A",
        "browser": "🌊",
        "shortname": "water wave"
      },
      {
        "number": 946,
        "code": "U+1F383",
        "browser": "🎃",
        "shortname": "jack-o-lantern"
      },
      {
        "number": 947,
        "code": "U+1F384",
        "browser": "🎄",
        "shortname": "Christmas tree"
      },
      {
        "number": 948,
        "code": "U+1F386",
        "browser": "🎆",
        "shortname": "fireworks"
      },
      {
        "number": 949,
        "code": "U+1F387",
        "browser": "🎇",
        "shortname": "sparkler"
      },
      {
        "number": 951,
        "code": "U+2728",
        "browser": "✨",
        "shortname": "sparkles"
      },
      {
        "number": 952,
        "code": "U+1F388",
        "browser": "🎈",
        "shortname": "balloon"
      },
      {
        "number": 953,
        "code": "U+1F389",
        "browser": "🎉",
        "shortname": "party popper"
      },
      {
        "number": 954,
        "code": "U+1F38A",
        "browser": "🎊",
        "shortname": "confetti ball"
      },
      {
        "number": 955,
        "code": "U+1F38B",
        "browser": "🎋",
        "shortname": "tanabata tree"
      },
      {
        "number": 956,
        "code": "U+1F38D",
        "browser": "🎍",
        "shortname": "pine decoration"
      },
      {
        "number": 957,
        "code": "U+1F38E",
        "browser": "🎎",
        "shortname": "Japanese dolls"
      },
      {
        "number": 958,
        "code": "U+1F38F",
        "browser": "🎏",
        "shortname": "carp streamer"
      },
      {
        "number": 959,
        "code": "U+1F390",
        "browser": "🎐",
        "shortname": "wind chime"
      },
      {
        "number": 960,
        "code": "U+1F391",
        "browser": "🎑",
        "shortname": "moon viewing ceremony"
      },
      {
        "number": 962,
        "code": "U+1F380",
        "browser": "🎀",
        "shortname": "ribbon"
      },
      {
        "number": 963,
        "code": "U+1F381",
        "browser": "🎁",
        "shortname": "wrapped gift"
      },
      {
        "number": 964,
        "code": "U+1F397",
        "browser": "🎗",
        "shortname": "reminder ribbon"
      },
      {
        "number": 965,
        "code": "U+1F39F",
        "browser": "🎟",
        "shortname": "admission tickets"
      },
      {
        "number": 966,
        "code": "U+1F3AB",
        "browser": "🎫",
        "shortname": "ticket"
      },
      {
        "number": 967,
        "code": "U+1F396",
        "browser": "🎖",
        "shortname": "military medal"
      },
      {
        "number": 968,
        "code": "U+1F3C6",
        "browser": "🏆",
        "shortname": "trophy"
      },
      {
        "number": 969,
        "code": "U+1F3C5",
        "browser": "🏅",
        "shortname": "sports medal"
      },
      {
        "number": 970,
        "code": "U+1F947",
        "browser": "🥇",
        "shortname": "1st place medal"
      },
      {
        "number": 971,
        "code": "U+1F948",
        "browser": "🥈",
        "shortname": "2nd place medal"
      },
      {
        "number": 972,
        "code": "U+1F949",
        "browser": "🥉",
        "shortname": "3rd place medal"
      },
      {
        "number": 973,
        "code": "U+26BD",
        "browser": "⚽",
        "shortname": "soccer ball"
      },
      {
        "number": 974,
        "code": "U+26BE",
        "browser": "⚾",
        "shortname": "baseball"
      },
      {
        "number": 976,
        "code": "U+1F3C0",
        "browser": "🏀",
        "shortname": "basketball"
      },
      {
        "number": 977,
        "code": "U+1F3D0",
        "browser": "🏐",
        "shortname": "volleyball"
      },
      {
        "number": 978,
        "code": "U+1F3C8",
        "browser": "🏈",
        "shortname": "american football"
      },
      {
        "number": 979,
        "code": "U+1F3C9",
        "browser": "🏉",
        "shortname": "rugby football"
      },
      {
        "number": 980,
        "code": "U+1F3BE",
        "browser": "🎾",
        "shortname": "tennis"
      },
      {
        "number": 982,
        "code": "U+1F3B3",
        "browser": "🎳",
        "shortname": "bowling"
      },
      {
        "number": 983,
        "code": "U+1F3CF",
        "browser": "🏏",
        "shortname": "cricket game"
      },
      {
        "number": 984,
        "code": "U+1F3D1",
        "browser": "🏑",
        "shortname": "field hockey"
      },
      {
        "number": 985,
        "code": "U+1F3D2",
        "browser": "🏒",
        "shortname": "ice hockey"
      },
      {
        "number": 987,
        "code": "U+1F3D3",
        "browser": "🏓",
        "shortname": "ping pong"
      },
      {
        "number": 988,
        "code": "U+1F3F8",
        "browser": "🏸",
        "shortname": "badminton"
      },
      {
        "number": 989,
        "code": "U+1F94A",
        "browser": "🥊",
        "shortname": "boxing glove"
      },
      {
        "number": 990,
        "code": "U+1F94B",
        "browser": "🥋",
        "shortname": "martial arts uniform"
      },
      {
        "number": 991,
        "code": "U+1F945",
        "browser": "🥅",
        "shortname": "goal net"
      },
      {
        "number": 992,
        "code": "U+26F3",
        "browser": "⛳",
        "shortname": "flag in hole"
      },
      {
        "number": 993,
        "code": "U+26F8",
        "browser": "⛸",
        "shortname": "ice skate"
      },
      {
        "number": 994,
        "code": "U+1F3A3",
        "browser": "🎣",
        "shortname": "fishing pole"
      },
      {
        "number": 996,
        "code": "U+1F3BD",
        "browser": "🎽",
        "shortname": "running shirt"
      },
      {
        "number": 997,
        "code": "U+1F3BF",
        "browser": "🎿",
        "shortname": "skis"
      },
      {
        "number": 1000,
        "code": "U+1F3AF",
        "browser": "🎯",
        "shortname": "direct hit"
      },
      {
        "number": 1003,
        "code": "U+1F3B1",
        "browser": "🎱",
        "shortname": "pool 8 ball"
      },
      {
        "number": 1004,
        "code": "U+1F52E",
        "browser": "🔮",
        "shortname": "crystal ball"
      },
      {
        "number": 1006,
        "code": "U+1F3AE",
        "browser": "🎮",
        "shortname": "video game"
      },
      {
        "number": 1007,
        "code": "U+1F579",
        "browser": "🕹",
        "shortname": "joystick"
      },
      {
        "number": 1008,
        "code": "U+1F3B0",
        "browser": "🎰",
        "shortname": "slot machine"
      },
      {
        "number": 1009,
        "code": "U+1F3B2",
        "browser": "🎲",
        "shortname": "game die"
      },
      {
        "number": 1012,
        "code": "U+2660",
        "browser": "♠",
        "shortname": "spade suit"
      },
      {
        "number": 1013,
        "code": "U+2665",
        "browser": "♥",
        "shortname": "heart suit"
      },
      {
        "number": 1014,
        "code": "U+2666",
        "browser": "♦",
        "shortname": "diamond suit"
      },
      {
        "number": 1015,
        "code": "U+2663",
        "browser": "♣",
        "shortname": "club suit"
      },
      {
        "number": 1016,
        "code": "U+265F",
        "browser": "♟",
        "shortname": "chess pawn"
      },
      {
        "number": 1017,
        "code": "U+1F0CF",
        "browser": "🃏",
        "shortname": "joker"
      },
      {
        "number": 1018,
        "code": "U+1F004",
        "browser": "🀄",
        "shortname": "mahjong red dragon"
      },
      {
        "number": 1019,
        "code": "U+1F3B4",
        "browser": "🎴",
        "shortname": "flower playing cards"
      },
      {
        "number": 1020,
        "code": "U+1F3AD",
        "browser": "🎭",
        "shortname": "performing arts"
      },
      {
        "number": 1021,
        "code": "U+1F5BC",
        "browser": "🖼",
        "shortname": "framed picture"
      },
      {
        "number": 1022,
        "code": "U+1F3A8",
        "browser": "🎨",
        "shortname": "artist palette"
      },
      {
        "number": 1025,
        "code": "U+1F453",
        "browser": "👓",
        "shortname": "glasses"
      },
      {
        "number": 1026,
        "code": "U+1F576",
        "browser": "🕶",
        "shortname": "sunglasses"
      },
      {
        "number": 1030,
        "code": "U+1F454",
        "browser": "👔",
        "shortname": "necktie"
      },
      {
        "number": 1031,
        "code": "U+1F455",
        "browser": "👕",
        "shortname": "t-shirt"
      },
      {
        "number": 1032,
        "code": "U+1F456",
        "browser": "👖",
        "shortname": "jeans"
      },
      {
        "number": 1037,
        "code": "U+1F457",
        "browser": "👗",
        "shortname": "dress"
      },
      {
        "number": 1038,
        "code": "U+1F458",
        "browser": "👘",
        "shortname": "kimono"
      },
      {
        "number": 1043,
        "code": "U+1F459",
        "browser": "👙",
        "shortname": "bikini"
      },
      {
        "number": 1044,
        "code": "U+1F45A",
        "browser": "👚",
        "shortname": "woman’s clothes"
      },
      {
        "number": 1045,
        "code": "U+1F45B",
        "browser": "👛",
        "shortname": "purse"
      },
      {
        "number": 1046,
        "code": "U+1F45C",
        "browser": "👜",
        "shortname": "handbag"
      },
      {
        "number": 1047,
        "code": "U+1F45D",
        "browser": "👝",
        "shortname": "clutch bag"
      },
      {
        "number": 1048,
        "code": "U+1F6CD",
        "browser": "🛍",
        "shortname": "shopping bags"
      },
      {
        "number": 1049,
        "code": "U+1F392",
        "browser": "🎒",
        "shortname": "backpack"
      },
      {
        "number": 1050,
        "code": "U+1F45E",
        "browser": "👞",
        "shortname": "man’s shoe"
      },
      {
        "number": 1051,
        "code": "U+1F45F",
        "browser": "👟",
        "shortname": "running shoe"
      },
      {
        "number": 1054,
        "code": "U+1F460",
        "browser": "👠",
        "shortname": "high-heeled shoe"
      },
      {
        "number": 1055,
        "code": "U+1F461",
        "browser": "👡",
        "shortname": "woman’s sandal"
      },
      {
        "number": 1057,
        "code": "U+1F462",
        "browser": "👢",
        "shortname": "woman’s boot"
      },
      {
        "number": 1058,
        "code": "U+1F451",
        "browser": "👑",
        "shortname": "crown"
      },
      {
        "number": 1059,
        "code": "U+1F452",
        "browser": "👒",
        "shortname": "woman’s hat"
      },
      {
        "number": 1060,
        "code": "U+1F3A9",
        "browser": "🎩",
        "shortname": "top hat"
      },
      {
        "number": 1061,
        "code": "U+1F393",
        "browser": "🎓",
        "shortname": "graduation cap"
      },
      {
        "number": 1063,
        "code": "U+26D1",
        "browser": "⛑",
        "shortname": "rescue worker’s helmet"
      },
      {
        "number": 1064,
        "code": "U+1F4FF",
        "browser": "📿",
        "shortname": "prayer beads"
      },
      {
        "number": 1065,
        "code": "U+1F484",
        "browser": "💄",
        "shortname": "lipstick"
      },
      {
        "number": 1066,
        "code": "U+1F48D",
        "browser": "💍",
        "shortname": "ring"
      },
      {
        "number": 1067,
        "code": "U+1F48E",
        "browser": "💎",
        "shortname": "gem stone"
      },
      {
        "number": 1068,
        "code": "U+1F507",
        "browser": "🔇",
        "shortname": "muted speaker"
      },
      {
        "number": 1069,
        "code": "U+1F508",
        "browser": "🔈",
        "shortname": "speaker low volume"
      },
      {
        "number": 1070,
        "code": "U+1F509",
        "browser": "🔉",
        "shortname": "speaker medium volume"
      },
      {
        "number": 1071,
        "code": "U+1F50A",
        "browser": "🔊",
        "shortname": "speaker high volume"
      },
      {
        "number": 1072,
        "code": "U+1F4E2",
        "browser": "📢",
        "shortname": "loudspeaker"
      },
      {
        "number": 1073,
        "code": "U+1F4E3",
        "browser": "📣",
        "shortname": "megaphone"
      },
      {
        "number": 1074,
        "code": "U+1F4EF",
        "browser": "📯",
        "shortname": "postal horn"
      },
      {
        "number": 1075,
        "code": "U+1F514",
        "browser": "🔔",
        "shortname": "bell"
      },
      {
        "number": 1076,
        "code": "U+1F515",
        "browser": "🔕",
        "shortname": "bell with slash"
      },
      {
        "number": 1077,
        "code": "U+1F3BC",
        "browser": "🎼",
        "shortname": "musical score"
      },
      {
        "number": 1078,
        "code": "U+1F3B5",
        "browser": "🎵",
        "shortname": "musical note"
      },
      {
        "number": 1079,
        "code": "U+1F3B6",
        "browser": "🎶",
        "shortname": "musical notes"
      },
      {
        "number": 1080,
        "code": "U+1F399",
        "browser": "🎙",
        "shortname": "studio microphone"
      },
      {
        "number": 1081,
        "code": "U+1F39A",
        "browser": "🎚",
        "shortname": "level slider"
      },
      {
        "number": 1082,
        "code": "U+1F39B",
        "browser": "🎛",
        "shortname": "control knobs"
      },
      {
        "number": 1083,
        "code": "U+1F3A4",
        "browser": "🎤",
        "shortname": "microphone"
      },
      {
        "number": 1084,
        "code": "U+1F3A7",
        "browser": "🎧",
        "shortname": "headphone"
      },
      {
        "number": 1085,
        "code": "U+1F4FB",
        "browser": "📻",
        "shortname": "radio"
      },
      {
        "number": 1086,
        "code": "U+1F3B7",
        "browser": "🎷",
        "shortname": "saxophone"
      },
      {
        "number": 1087,
        "code": "U+1F3B8",
        "browser": "🎸",
        "shortname": "guitar"
      },
      {
        "number": 1088,
        "code": "U+1F3B9",
        "browser": "🎹",
        "shortname": "musical keyboard"
      },
      {
        "number": 1089,
        "code": "U+1F3BA",
        "browser": "🎺",
        "shortname": "trumpet"
      },
      {
        "number": 1090,
        "code": "U+1F3BB",
        "browser": "🎻",
        "shortname": "violin"
      },
      {
        "number": 1092,
        "code": "U+1F941",
        "browser": "🥁",
        "shortname": "drum"
      },
      {
        "number": 1093,
        "code": "U+1F4F1",
        "browser": "📱",
        "shortname": "mobile phone"
      },
      {
        "number": 1094,
        "code": "U+1F4F2",
        "browser": "📲",
        "shortname": "mobile phone with arrow"
      },
      {
        "number": 1095,
        "code": "U+260E",
        "browser": "☎",
        "shortname": "telephone"
      },
      {
        "number": 1096,
        "code": "U+1F4DE",
        "browser": "📞",
        "shortname": "telephone receiver"
      },
      {
        "number": 1097,
        "code": "U+1F4DF",
        "browser": "📟",
        "shortname": "pager"
      },
      {
        "number": 1098,
        "code": "U+1F4E0",
        "browser": "📠",
        "shortname": "fax machine"
      },
      {
        "number": 1099,
        "code": "U+1F50B",
        "browser": "🔋",
        "shortname": "battery"
      },
      {
        "number": 1100,
        "code": "U+1F50C",
        "browser": "🔌",
        "shortname": "electric plug"
      },
      {
        "number": 1101,
        "code": "U+1F4BB",
        "browser": "💻",
        "shortname": "laptop"
      },
      {
        "number": 1102,
        "code": "U+1F5A5",
        "browser": "🖥",
        "shortname": "desktop computer"
      },
      {
        "number": 1103,
        "code": "U+1F5A8",
        "browser": "🖨",
        "shortname": "printer"
      },
      {
        "number": 1104,
        "code": "U+2328",
        "browser": "⌨",
        "shortname": "keyboard"
      },
      {
        "number": 1105,
        "code": "U+1F5B1",
        "browser": "🖱",
        "shortname": "computer mouse"
      },
      {
        "number": 1106,
        "code": "U+1F5B2",
        "browser": "🖲",
        "shortname": "trackball"
      },
      {
        "number": 1107,
        "code": "U+1F4BD",
        "browser": "💽",
        "shortname": "computer disk"
      },
      {
        "number": 1108,
        "code": "U+1F4BE",
        "browser": "💾",
        "shortname": "floppy disk"
      },
      {
        "number": 1109,
        "code": "U+1F4BF",
        "browser": "💿",
        "shortname": "optical disk"
      },
      {
        "number": 1110,
        "code": "U+1F4C0",
        "browser": "📀",
        "shortname": "dvd"
      },
      {
        "number": 1112,
        "code": "U+1F3A5",
        "browser": "🎥",
        "shortname": "movie camera"
      },
      {
        "number": 1113,
        "code": "U+1F39E",
        "browser": "🎞",
        "shortname": "film frames"
      },
      {
        "number": 1114,
        "code": "U+1F4FD",
        "browser": "📽",
        "shortname": "film projector"
      },
      {
        "number": 1115,
        "code": "U+1F3AC",
        "browser": "🎬",
        "shortname": "clapper board"
      },
      {
        "number": 1116,
        "code": "U+1F4FA",
        "browser": "📺",
        "shortname": "television"
      },
      {
        "number": 1117,
        "code": "U+1F4F7",
        "browser": "📷",
        "shortname": "camera"
      },
      {
        "number": 1118,
        "code": "U+1F4F8",
        "browser": "📸",
        "shortname": "camera with flash"
      },
      {
        "number": 1119,
        "code": "U+1F4F9",
        "browser": "📹",
        "shortname": "video camera"
      },
      {
        "number": 1120,
        "code": "U+1F4FC",
        "browser": "📼",
        "shortname": "videocassette"
      },
      {
        "number": 1121,
        "code": "U+1F50D",
        "browser": "🔍",
        "shortname": "magnifying glass tilted left"
      },
      {
        "number": 1122,
        "code": "U+1F50E",
        "browser": "🔎",
        "shortname": "magnifying glass tilted right"
      },
      {
        "number": 1123,
        "code": "U+1F56F",
        "browser": "🕯",
        "shortname": "candle"
      },
      {
        "number": 1124,
        "code": "U+1F4A1",
        "browser": "💡",
        "shortname": "light bulb"
      },
      {
        "number": 1125,
        "code": "U+1F526",
        "browser": "🔦",
        "shortname": "flashlight"
      },
      {
        "number": 1126,
        "code": "U+1F3EE",
        "browser": "🏮",
        "shortname": "red paper lantern"
      },
      {
        "number": 1128,
        "code": "U+1F4D4",
        "browser": "📔",
        "shortname": "notebook with decorative cover"
      },
      {
        "number": 1129,
        "code": "U+1F4D5",
        "browser": "📕",
        "shortname": "closed book"
      },
      {
        "number": 1130,
        "code": "U+1F4D6",
        "browser": "📖",
        "shortname": "open book"
      },
      {
        "number": 1131,
        "code": "U+1F4D7",
        "browser": "📗",
        "shortname": "green book"
      },
      {
        "number": 1132,
        "code": "U+1F4D8",
        "browser": "📘",
        "shortname": "blue book"
      },
      {
        "number": 1133,
        "code": "U+1F4D9",
        "browser": "📙",
        "shortname": "orange book"
      },
      {
        "number": 1134,
        "code": "U+1F4DA",
        "browser": "📚",
        "shortname": "books"
      },
      {
        "number": 1135,
        "code": "U+1F4D3",
        "browser": "📓",
        "shortname": "notebook"
      },
      {
        "number": 1136,
        "code": "U+1F4D2",
        "browser": "📒",
        "shortname": "ledger"
      },
      {
        "number": 1137,
        "code": "U+1F4C3",
        "browser": "📃",
        "shortname": "page with curl"
      },
      {
        "number": 1138,
        "code": "U+1F4DC",
        "browser": "📜",
        "shortname": "scroll"
      },
      {
        "number": 1139,
        "code": "U+1F4C4",
        "browser": "📄",
        "shortname": "page facing up"
      },
      {
        "number": 1140,
        "code": "U+1F4F0",
        "browser": "📰",
        "shortname": "newspaper"
      },
      {
        "number": 1141,
        "code": "U+1F5DE",
        "browser": "🗞",
        "shortname": "rolled-up newspaper"
      },
      {
        "number": 1142,
        "code": "U+1F4D1",
        "browser": "📑",
        "shortname": "bookmark tabs"
      },
      {
        "number": 1143,
        "code": "U+1F516",
        "browser": "🔖",
        "shortname": "bookmark"
      },
      {
        "number": 1144,
        "code": "U+1F3F7",
        "browser": "🏷",
        "shortname": "label"
      },
      {
        "number": 1145,
        "code": "U+1F4B0",
        "browser": "💰",
        "shortname": "money bag"
      },
      {
        "number": 1146,
        "code": "U+1F4B4",
        "browser": "💴",
        "shortname": "yen banknote"
      },
      {
        "number": 1147,
        "code": "U+1F4B5",
        "browser": "💵",
        "shortname": "dollar banknote"
      },
      {
        "number": 1148,
        "code": "U+1F4B6",
        "browser": "💶",
        "shortname": "euro banknote"
      },
      {
        "number": 1149,
        "code": "U+1F4B7",
        "browser": "💷",
        "shortname": "pound banknote"
      },
      {
        "number": 1150,
        "code": "U+1F4B8",
        "browser": "💸",
        "shortname": "money with wings"
      },
      {
        "number": 1151,
        "code": "U+1F4B3",
        "browser": "💳",
        "shortname": "credit card"
      },
      {
        "number": 1153,
        "code": "U+1F4B9",
        "browser": "💹",
        "shortname": "chart increasing with yen"
      },
      {
        "number": 1154,
        "code": "U+2709",
        "browser": "✉",
        "shortname": "envelope"
      },
      {
        "number": 1155,
        "code": "U+1F4E7",
        "browser": "📧",
        "shortname": "e-mail"
      },
      {
        "number": 1156,
        "code": "U+1F4E8",
        "browser": "📨",
        "shortname": "incoming envelope"
      },
      {
        "number": 1157,
        "code": "U+1F4E9",
        "browser": "📩",
        "shortname": "envelope with arrow"
      },
      {
        "number": 1158,
        "code": "U+1F4E4",
        "browser": "📤",
        "shortname": "outbox tray"
      },
      {
        "number": 1159,
        "code": "U+1F4E5",
        "browser": "📥",
        "shortname": "inbox tray"
      },
      {
        "number": 1160,
        "code": "U+1F4E6",
        "browser": "📦",
        "shortname": "package"
      },
      {
        "number": 1161,
        "code": "U+1F4EB",
        "browser": "📫",
        "shortname": "closed mailbox with raised flag"
      },
      {
        "number": 1162,
        "code": "U+1F4EA",
        "browser": "📪",
        "shortname": "closed mailbox with lowered flag"
      },
      {
        "number": 1163,
        "code": "U+1F4EC",
        "browser": "📬",
        "shortname": "open mailbox with raised flag"
      },
      {
        "number": 1164,
        "code": "U+1F4ED",
        "browser": "📭",
        "shortname": "open mailbox with lowered flag"
      },
      {
        "number": 1165,
        "code": "U+1F4EE",
        "browser": "📮",
        "shortname": "postbox"
      },
      {
        "number": 1166,
        "code": "U+1F5F3",
        "browser": "🗳",
        "shortname": "ballot box with ballot"
      },
      {
        "number": 1167,
        "code": "U+270F",
        "browser": "✏",
        "shortname": "pencil"
      },
      {
        "number": 1168,
        "code": "U+2712",
        "browser": "✒",
        "shortname": "black nib"
      },
      {
        "number": 1169,
        "code": "U+1F58B",
        "browser": "🖋",
        "shortname": "fountain pen"
      },
      {
        "number": 1170,
        "code": "U+1F58A",
        "browser": "🖊",
        "shortname": "pen"
      },
      {
        "number": 1171,
        "code": "U+1F58C",
        "browser": "🖌",
        "shortname": "paintbrush"
      },
      {
        "number": 1172,
        "code": "U+1F58D",
        "browser": "🖍",
        "shortname": "crayon"
      },
      {
        "number": 1173,
        "code": "U+1F4DD",
        "browser": "📝",
        "shortname": "memo"
      },
      {
        "number": 1174,
        "code": "U+1F4BC",
        "browser": "💼",
        "shortname": "briefcase"
      },
      {
        "number": 1175,
        "code": "U+1F4C1",
        "browser": "📁",
        "shortname": "file folder"
      },
      {
        "number": 1176,
        "code": "U+1F4C2",
        "browser": "📂",
        "shortname": "open file folder"
      },
      {
        "number": 1177,
        "code": "U+1F5C2",
        "browser": "🗂",
        "shortname": "card index dividers"
      },
      {
        "number": 1178,
        "code": "U+1F4C5",
        "browser": "📅",
        "shortname": "calendar"
      },
      {
        "number": 1179,
        "code": "U+1F4C6",
        "browser": "📆",
        "shortname": "tear-off calendar"
      },
      {
        "number": 1180,
        "code": "U+1F5D2",
        "browser": "🗒",
        "shortname": "spiral notepad"
      },
      {
        "number": 1181,
        "code": "U+1F5D3",
        "browser": "🗓",
        "shortname": "spiral calendar"
      },
      {
        "number": 1182,
        "code": "U+1F4C7",
        "browser": "📇",
        "shortname": "card index"
      },
      {
        "number": 1183,
        "code": "U+1F4C8",
        "browser": "📈",
        "shortname": "chart increasing"
      },
      {
        "number": 1184,
        "code": "U+1F4C9",
        "browser": "📉",
        "shortname": "chart decreasing"
      },
      {
        "number": 1185,
        "code": "U+1F4CA",
        "browser": "📊",
        "shortname": "bar chart"
      },
      {
        "number": 1186,
        "code": "U+1F4CB",
        "browser": "📋",
        "shortname": "clipboard"
      },
      {
        "number": 1187,
        "code": "U+1F4CC",
        "browser": "📌",
        "shortname": "pushpin"
      },
      {
        "number": 1188,
        "code": "U+1F4CD",
        "browser": "📍",
        "shortname": "round pushpin"
      },
      {
        "number": 1189,
        "code": "U+1F4CE",
        "browser": "📎",
        "shortname": "paperclip"
      },
      {
        "number": 1190,
        "code": "U+1F587",
        "browser": "🖇",
        "shortname": "linked paperclips"
      },
      {
        "number": 1191,
        "code": "U+1F4CF",
        "browser": "📏",
        "shortname": "straight ruler"
      },
      {
        "number": 1192,
        "code": "U+1F4D0",
        "browser": "📐",
        "shortname": "triangular ruler"
      },
      {
        "number": 1193,
        "code": "U+2702",
        "browser": "✂",
        "shortname": "scissors"
      },
      {
        "number": 1194,
        "code": "U+1F5C3",
        "browser": "🗃",
        "shortname": "card file box"
      },
      {
        "number": 1195,
        "code": "U+1F5C4",
        "browser": "🗄",
        "shortname": "file cabinet"
      },
      {
        "number": 1196,
        "code": "U+1F5D1",
        "browser": "🗑",
        "shortname": "wastebasket"
      },
      {
        "number": 1197,
        "code": "U+1F512",
        "browser": "🔒",
        "shortname": "locked"
      },
      {
        "number": 1198,
        "code": "U+1F513",
        "browser": "🔓",
        "shortname": "unlocked"
      },
      {
        "number": 1199,
        "code": "U+1F50F",
        "browser": "🔏",
        "shortname": "locked with pen"
      },
      {
        "number": 1200,
        "code": "U+1F510",
        "browser": "🔐",
        "shortname": "locked with key"
      },
      {
        "number": 1201,
        "code": "U+1F511",
        "browser": "🔑",
        "shortname": "key"
      },
      {
        "number": 1202,
        "code": "U+1F5DD",
        "browser": "🗝",
        "shortname": "old key"
      },
      {
        "number": 1203,
        "code": "U+1F528",
        "browser": "🔨",
        "shortname": "hammer"
      },
      {
        "number": 1205,
        "code": "U+26CF",
        "browser": "⛏",
        "shortname": "pick"
      },
      {
        "number": 1206,
        "code": "U+2692",
        "browser": "⚒",
        "shortname": "hammer and pick"
      },
      {
        "number": 1207,
        "code": "U+1F6E0",
        "browser": "🛠",
        "shortname": "hammer and wrench"
      },
      {
        "number": 1208,
        "code": "U+1F5E1",
        "browser": "🗡",
        "shortname": "dagger"
      },
      {
        "number": 1209,
        "code": "U+2694",
        "browser": "⚔",
        "shortname": "crossed swords"
      },
      {
        "number": 1210,
        "code": "U+1F52B",
        "browser": "🔫",
        "shortname": "pistol"
      },
      {
        "number": 1211,
        "code": "U+1F3F9",
        "browser": "🏹",
        "shortname": "bow and arrow"
      },
      {
        "number": 1212,
        "code": "U+1F6E1",
        "browser": "🛡",
        "shortname": "shield"
      },
      {
        "number": 1213,
        "code": "U+1F527",
        "browser": "🔧",
        "shortname": "wrench"
      },
      {
        "number": 1214,
        "code": "U+1F529",
        "browser": "🔩",
        "shortname": "nut and bolt"
      },
      {
        "number": 1215,
        "code": "U+2699",
        "browser": "⚙",
        "shortname": "gear"
      },
      {
        "number": 1216,
        "code": "U+1F5DC",
        "browser": "🗜",
        "shortname": "clamp"
      },
      {
        "number": 1217,
        "code": "U+2696",
        "browser": "⚖",
        "shortname": "balance scale"
      },
      {
        "number": 1219,
        "code": "U+1F517",
        "browser": "🔗",
        "shortname": "link"
      },
      {
        "number": 1220,
        "code": "U+26D3",
        "browser": "⛓",
        "shortname": "chains"
      },
      {
        "number": 1223,
        "code": "U+2697",
        "browser": "⚗",
        "shortname": "alembic"
      },
      {
        "number": 1227,
        "code": "U+1F52C",
        "browser": "🔬",
        "shortname": "microscope"
      },
      {
        "number": 1228,
        "code": "U+1F52D",
        "browser": "🔭",
        "shortname": "telescope"
      },
      {
        "number": 1229,
        "code": "U+1F4E1",
        "browser": "📡",
        "shortname": "satellite antenna"
      },
      {
        "number": 1230,
        "code": "U+1F489",
        "browser": "💉",
        "shortname": "syringe"
      },
      {
        "number": 1232,
        "code": "U+1F48A",
        "browser": "💊",
        "shortname": "pill"
      },
      {
        "number": 1235,
        "code": "U+1F6AA",
        "browser": "🚪",
        "shortname": "door"
      },
      {
        "number": 1236,
        "code": "U+1F6CF",
        "browser": "🛏",
        "shortname": "bed"
      },
      {
        "number": 1237,
        "code": "U+1F6CB",
        "browser": "🛋",
        "shortname": "couch and lamp"
      },
      {
        "number": 1239,
        "code": "U+1F6BD",
        "browser": "🚽",
        "shortname": "toilet"
      },
      {
        "number": 1240,
        "code": "U+1F6BF",
        "browser": "🚿",
        "shortname": "shower"
      },
      {
        "number": 1241,
        "code": "U+1F6C1",
        "browser": "🛁",
        "shortname": "bathtub"
      },
      {
        "number": 1251,
        "code": "U+1F6D2",
        "browser": "🛒",
        "shortname": "shopping cart"
      },
      {
        "number": 1252,
        "code": "U+1F6AC",
        "browser": "🚬",
        "shortname": "cigarette"
      },
      {
        "number": 1253,
        "code": "U+26B0",
        "browser": "⚰",
        "shortname": "coffin"
      },
      {
        "number": 1254,
        "code": "U+26B1",
        "browser": "⚱",
        "shortname": "funeral urn"
      },
      {
        "number": 1255,
        "code": "U+1F5FF",
        "browser": "🗿",
        "shortname": "moai"
      },
      {
        "number": 1256,
        "code": "U+1F3E7",
        "browser": "🏧",
        "shortname": "ATM sign"
      },
      {
        "number": 1257,
        "code": "U+1F6AE",
        "browser": "🚮",
        "shortname": "litter in bin sign"
      },
      {
        "number": 1258,
        "code": "U+1F6B0",
        "browser": "🚰",
        "shortname": "potable water"
      },
      {
        "number": 1259,
        "code": "U+267F",
        "browser": "♿",
        "shortname": "wheelchair symbol"
      },
      {
        "number": 1260,
        "code": "U+1F6B9",
        "browser": "🚹",
        "shortname": "men’s room"
      },
      {
        "number": 1261,
        "code": "U+1F6BA",
        "browser": "🚺",
        "shortname": "women’s room"
      },
      {
        "number": 1262,
        "code": "U+1F6BB",
        "browser": "🚻",
        "shortname": "restroom"
      },
      {
        "number": 1263,
        "code": "U+1F6BC",
        "browser": "🚼",
        "shortname": "baby symbol"
      },
      {
        "number": 1264,
        "code": "U+1F6BE",
        "browser": "🚾",
        "shortname": "water closet"
      },
      {
        "number": 1265,
        "code": "U+1F6C2",
        "browser": "🛂",
        "shortname": "passport control"
      },
      {
        "number": 1266,
        "code": "U+1F6C3",
        "browser": "🛃",
        "shortname": "customs"
      },
      {
        "number": 1267,
        "code": "U+1F6C4",
        "browser": "🛄",
        "shortname": "baggage claim"
      },
      {
        "number": 1268,
        "code": "U+1F6C5",
        "browser": "🛅",
        "shortname": "left luggage"
      },
      {
        "number": 1269,
        "code": "U+26A0",
        "browser": "⚠",
        "shortname": "warning"
      },
      {
        "number": 1270,
        "code": "U+1F6B8",
        "browser": "🚸",
        "shortname": "children crossing"
      },
      {
        "number": 1271,
        "code": "U+26D4",
        "browser": "⛔",
        "shortname": "no entry"
      },
      {
        "number": 1272,
        "code": "U+1F6AB",
        "browser": "🚫",
        "shortname": "prohibited"
      },
      {
        "number": 1273,
        "code": "U+1F6B3",
        "browser": "🚳",
        "shortname": "no bicycles"
      },
      {
        "number": 1274,
        "code": "U+1F6AD",
        "browser": "🚭",
        "shortname": "no smoking"
      },
      {
        "number": 1275,
        "code": "U+1F6AF",
        "browser": "🚯",
        "shortname": "no littering"
      },
      {
        "number": 1276,
        "code": "U+1F6B1",
        "browser": "🚱",
        "shortname": "non-potable water"
      },
      {
        "number": 1277,
        "code": "U+1F6B7",
        "browser": "🚷",
        "shortname": "no pedestrians"
      },
      {
        "number": 1278,
        "code": "U+1F4F5",
        "browser": "📵",
        "shortname": "no mobile phones"
      },
      {
        "number": 1279,
        "code": "U+1F51E",
        "browser": "🔞",
        "shortname": "no one under eighteen"
      },
      {
        "number": 1280,
        "code": "U+2622",
        "browser": "☢",
        "shortname": "radioactive"
      },
      {
        "number": 1281,
        "code": "U+2623",
        "browser": "☣",
        "shortname": "biohazard"
      },
      {
        "number": 1282,
        "code": "U+2B06",
        "browser": "⬆",
        "shortname": "up arrow"
      },
      {
        "number": 1283,
        "code": "U+2197",
        "browser": "↗",
        "shortname": "up-right arrow"
      },
      {
        "number": 1284,
        "code": "U+27A1",
        "browser": "➡",
        "shortname": "right arrow"
      },
      {
        "number": 1285,
        "code": "U+2198",
        "browser": "↘",
        "shortname": "down-right arrow"
      },
      {
        "number": 1286,
        "code": "U+2B07",
        "browser": "⬇",
        "shortname": "down arrow"
      },
      {
        "number": 1287,
        "code": "U+2199",
        "browser": "↙",
        "shortname": "down-left arrow"
      },
      {
        "number": 1288,
        "code": "U+2B05",
        "browser": "⬅",
        "shortname": "left arrow"
      },
      {
        "number": 1289,
        "code": "U+2196",
        "browser": "↖",
        "shortname": "up-left arrow"
      },
      {
        "number": 1290,
        "code": "U+2195",
        "browser": "↕",
        "shortname": "up-down arrow"
      },
      {
        "number": 1291,
        "code": "U+2194",
        "browser": "↔",
        "shortname": "left-right arrow"
      },
      {
        "number": 1292,
        "code": "U+21A9",
        "browser": "↩",
        "shortname": "right arrow curving left"
      },
      {
        "number": 1293,
        "code": "U+21AA",
        "browser": "↪",
        "shortname": "left arrow curving right"
      },
      {
        "number": 1294,
        "code": "U+2934",
        "browser": "⤴",
        "shortname": "right arrow curving up"
      },
      {
        "number": 1295,
        "code": "U+2935",
        "browser": "⤵",
        "shortname": "right arrow curving down"
      },
      {
        "number": 1296,
        "code": "U+1F503",
        "browser": "🔃",
        "shortname": "clockwise vertical arrows"
      },
      {
        "number": 1297,
        "code": "U+1F504",
        "browser": "🔄",
        "shortname": "counterclockwise arrows button"
      },
      {
        "number": 1298,
        "code": "U+1F519",
        "browser": "🔙",
        "shortname": "BACK arrow"
      },
      {
        "number": 1299,
        "code": "U+1F51A",
        "browser": "🔚",
        "shortname": "END arrow"
      },
      {
        "number": 1300,
        "code": "U+1F51B",
        "browser": "🔛",
        "shortname": "ON! arrow"
      },
      {
        "number": 1301,
        "code": "U+1F51C",
        "browser": "🔜",
        "shortname": "SOON arrow"
      },
      {
        "number": 1302,
        "code": "U+1F51D",
        "browser": "🔝",
        "shortname": "TOP arrow"
      },
      {
        "number": 1303,
        "code": "U+1F6D0",
        "browser": "🛐",
        "shortname": "place of worship"
      },
      {
        "number": 1304,
        "code": "U+269B",
        "browser": "⚛",
        "shortname": "atom symbol"
      },
      {
        "number": 1305,
        "code": "U+1F549",
        "browser": "🕉",
        "shortname": "om"
      },
      {
        "number": 1306,
        "code": "U+2721",
        "browser": "✡",
        "shortname": "star of David"
      },
      {
        "number": 1307,
        "code": "U+2638",
        "browser": "☸",
        "shortname": "wheel of dharma"
      },
      {
        "number": 1308,
        "code": "U+262F",
        "browser": "☯",
        "shortname": "yin yang"
      },
      {
        "number": 1309,
        "code": "U+271D",
        "browser": "✝",
        "shortname": "latin cross"
      },
      {
        "number": 1310,
        "code": "U+2626",
        "browser": "☦",
        "shortname": "orthodox cross"
      },
      {
        "number": 1311,
        "code": "U+262A",
        "browser": "☪",
        "shortname": "star and crescent"
      },
      {
        "number": 1312,
        "code": "U+262E",
        "browser": "☮",
        "shortname": "peace symbol"
      },
      {
        "number": 1313,
        "code": "U+1F54E",
        "browser": "🕎",
        "shortname": "menorah"
      },
      {
        "number": 1314,
        "code": "U+1F52F",
        "browser": "🔯",
        "shortname": "dotted six-pointed star"
      },
      {
        "number": 1315,
        "code": "U+2648",
        "browser": "♈",
        "shortname": "Aries"
      },
      {
        "number": 1316,
        "code": "U+2649",
        "browser": "♉",
        "shortname": "Taurus"
      },
      {
        "number": 1317,
        "code": "U+264A",
        "browser": "♊",
        "shortname": "Gemini"
      },
      {
        "number": 1318,
        "code": "U+264B",
        "browser": "♋",
        "shortname": "Cancer"
      },
      {
        "number": 1319,
        "code": "U+264C",
        "browser": "♌",
        "shortname": "Leo"
      },
      {
        "number": 1320,
        "code": "U+264D",
        "browser": "♍",
        "shortname": "Virgo"
      },
      {
        "number": 1321,
        "code": "U+264E",
        "browser": "♎",
        "shortname": "Libra"
      },
      {
        "number": 1322,
        "code": "U+264F",
        "browser": "♏",
        "shortname": "Scorpio"
      },
      {
        "number": 1323,
        "code": "U+2650",
        "browser": "♐",
        "shortname": "Sagittarius"
      },
      {
        "number": 1324,
        "code": "U+2651",
        "browser": "♑",
        "shortname": "Capricorn"
      },
      {
        "number": 1325,
        "code": "U+2652",
        "browser": "♒",
        "shortname": "Aquarius"
      },
      {
        "number": 1326,
        "code": "U+2653",
        "browser": "♓",
        "shortname": "Pisces"
      },
      {
        "number": 1327,
        "code": "U+26CE",
        "browser": "⛎",
        "shortname": "Ophiuchus"
      },
      {
        "number": 1328,
        "code": "U+1F500",
        "browser": "🔀",
        "shortname": "shuffle tracks button"
      },
      {
        "number": 1329,
        "code": "U+1F501",
        "browser": "🔁",
        "shortname": "repeat button"
      },
      {
        "number": 1330,
        "code": "U+1F502",
        "browser": "🔂",
        "shortname": "repeat single button"
      },
      {
        "number": 1331,
        "code": "U+25B6",
        "browser": "▶",
        "shortname": "play button"
      },
      {
        "number": 1332,
        "code": "U+23E9",
        "browser": "⏩",
        "shortname": "fast-forward button"
      },
      {
        "number": 1333,
        "code": "U+23ED",
        "browser": "⏭",
        "shortname": "next track button"
      },
      {
        "number": 1334,
        "code": "U+23EF",
        "browser": "⏯",
        "shortname": "play or pause button"
      },
      {
        "number": 1335,
        "code": "U+25C0",
        "browser": "◀",
        "shortname": "reverse button"
      },
      {
        "number": 1336,
        "code": "U+23EA",
        "browser": "⏪",
        "shortname": "fast reverse button"
      },
      {
        "number": 1337,
        "code": "U+23EE",
        "browser": "⏮",
        "shortname": "last track button"
      },
      {
        "number": 1338,
        "code": "U+1F53C",
        "browser": "🔼",
        "shortname": "upwards button"
      },
      {
        "number": 1339,
        "code": "U+23EB",
        "browser": "⏫",
        "shortname": "fast up button"
      },
      {
        "number": 1340,
        "code": "U+1F53D",
        "browser": "🔽",
        "shortname": "downwards button"
      },
      {
        "number": 1341,
        "code": "U+23EC",
        "browser": "⏬",
        "shortname": "fast down button"
      },
      {
        "number": 1342,
        "code": "U+23F8",
        "browser": "⏸",
        "shortname": "pause button"
      },
      {
        "number": 1343,
        "code": "U+23F9",
        "browser": "⏹",
        "shortname": "stop button"
      },
      {
        "number": 1344,
        "code": "U+23FA",
        "browser": "⏺",
        "shortname": "record button"
      },
      {
        "number": 1345,
        "code": "U+23CF",
        "browser": "⏏",
        "shortname": "eject button"
      },
      {
        "number": 1346,
        "code": "U+1F3A6",
        "browser": "🎦",
        "shortname": "cinema"
      },
      {
        "number": 1347,
        "code": "U+1F505",
        "browser": "🔅",
        "shortname": "dim button"
      },
      {
        "number": 1348,
        "code": "U+1F506",
        "browser": "🔆",
        "shortname": "bright button"
      },
      {
        "number": 1349,
        "code": "U+1F4F6",
        "browser": "📶",
        "shortname": "antenna bars"
      },
      {
        "number": 1350,
        "code": "U+1F4F3",
        "browser": "📳",
        "shortname": "vibration mode"
      },
      {
        "number": 1351,
        "code": "U+1F4F4",
        "browser": "📴",
        "shortname": "mobile phone off"
      },
      {
        "number": 1352,
        "code": "U+2640",
        "browser": "♀",
        "shortname": "female sign"
      },
      {
        "number": 1353,
        "code": "U+2642",
        "browser": "♂",
        "shortname": "male sign"
      },
      {
        "number": 1354,
        "code": "U+2716",
        "browser": "✖",
        "shortname": "multiply"
      },
      {
        "number": 1355,
        "code": "U+2795",
        "browser": "➕",
        "shortname": "plus"
      },
      {
        "number": 1356,
        "code": "U+2796",
        "browser": "➖",
        "shortname": "minus"
      },
      {
        "number": 1357,
        "code": "U+2797",
        "browser": "➗",
        "shortname": "divide"
      },
      {
        "number": 1358,
        "code": "U+267E",
        "browser": "♾",
        "shortname": "infinity"
      },
      {
        "number": 1359,
        "code": "U+203C",
        "browser": "‼",
        "shortname": "double exclamation mark"
      },
      {
        "number": 1360,
        "code": "U+2049",
        "browser": "⁉",
        "shortname": "exclamation question mark"
      },
      {
        "number": 1361,
        "code": "U+2753",
        "browser": "❓",
        "shortname": "question mark"
      },
      {
        "number": 1362,
        "code": "U+2754",
        "browser": "❔",
        "shortname": "white question mark"
      },
      {
        "number": 1363,
        "code": "U+2755",
        "browser": "❕",
        "shortname": "white exclamation mark"
      },
      {
        "number": 1364,
        "code": "U+2757",
        "browser": "❗",
        "shortname": "exclamation mark"
      },
      {
        "number": 1365,
        "code": "U+3030",
        "browser": "〰",
        "shortname": "wavy dash"
      },
      {
        "number": 1366,
        "code": "U+1F4B1",
        "browser": "💱",
        "shortname": "currency exchange"
      },
      {
        "number": 1367,
        "code": "U+1F4B2",
        "browser": "💲",
        "shortname": "heavy dollar sign"
      },
      {
        "number": 1368,
        "code": "U+2695",
        "browser": "⚕",
        "shortname": "medical symbol"
      },
      {
        "number": 1369,
        "code": "U+267B",
        "browser": "♻",
        "shortname": "recycling symbol"
      },
      {
        "number": 1370,
        "code": "U+269C",
        "browser": "⚜",
        "shortname": "fleur-de-lis"
      },
      {
        "number": 1371,
        "code": "U+1F531",
        "browser": "🔱",
        "shortname": "trident emblem"
      },
      {
        "number": 1372,
        "code": "U+1F4DB",
        "browser": "📛",
        "shortname": "name badge"
      },
      {
        "number": 1373,
        "code": "U+1F530",
        "browser": "🔰",
        "shortname": "Japanese symbol for beginner"
      },
      {
        "number": 1374,
        "code": "U+2B55",
        "browser": "⭕",
        "shortname": "hollow red circle"
      },
      {
        "number": 1375,
        "code": "U+2705",
        "browser": "✅",
        "shortname": "check mark button"
      },
      {
        "number": 1376,
        "code": "U+2611",
        "browser": "☑",
        "shortname": "check box with check"
      },
      {
        "number": 1377,
        "code": "U+2714",
        "browser": "✔",
        "shortname": "check mark"
      },
      {
        "number": 1378,
        "code": "U+274C",
        "browser": "❌",
        "shortname": "cross mark"
      },
      {
        "number": 1379,
        "code": "U+274E",
        "browser": "❎",
        "shortname": "cross mark button"
      },
      {
        "number": 1380,
        "code": "U+27B0",
        "browser": "➰",
        "shortname": "curly loop"
      },
      {
        "number": 1381,
        "code": "U+27BF",
        "browser": "➿",
        "shortname": "double curly loop"
      },
      {
        "number": 1382,
        "code": "U+303D",
        "browser": "〽",
        "shortname": "part alternation mark"
      },
      {
        "number": 1383,
        "code": "U+2733",
        "browser": "✳",
        "shortname": "eight-spoked asterisk"
      },
      {
        "number": 1384,
        "code": "U+2734",
        "browser": "✴",
        "shortname": "eight-pointed star"
      },
      {
        "number": 1385,
        "code": "U+2747",
        "browser": "❇",
        "shortname": "sparkle"
      },
      {
        "number": 1386,
        "code": "U+00A9",
        "browser": "©",
        "shortname": "copyright"
      },
      {
        "number": 1387,
        "code": "U+00AE",
        "browser": "®",
        "shortname": "registered"
      },
      {
        "number": 1388,
        "code": "U+2122",
        "browser": "™",
        "shortname": "trade mark"
      },
      {
        "number": 1389,
        "code": "U+0023 U+FE0F U+20E3",
        "browser": "#️⃣",
        "shortname": "keycap: #"
      },
      {
        "number": 1390,
        "code": "U+002A U+FE0F U+20E3",
        "browser": "*️⃣",
        "shortname": "keycap: *"
      },
      {
        "number": 1391,
        "code": "U+0030 U+FE0F U+20E3",
        "browser": "0️⃣",
        "shortname": "keycap: 0"
      },
      {
        "number": 1392,
        "code": "U+0031 U+FE0F U+20E3",
        "browser": "1️⃣",
        "shortname": "keycap: 1"
      },
      {
        "number": 1393,
        "code": "U+0032 U+FE0F U+20E3",
        "browser": "2️⃣",
        "shortname": "keycap: 2"
      },
      {
        "number": 1394,
        "code": "U+0033 U+FE0F U+20E3",
        "browser": "3️⃣",
        "shortname": "keycap: 3"
      },
      {
        "number": 1395,
        "code": "U+0034 U+FE0F U+20E3",
        "browser": "4️⃣",
        "shortname": "keycap: 4"
      },
      {
        "number": 1396,
        "code": "U+0035 U+FE0F U+20E3",
        "browser": "5️⃣",
        "shortname": "keycap: 5"
      },
      {
        "number": 1397,
        "code": "U+0036 U+FE0F U+20E3",
        "browser": "6️⃣",
        "shortname": "keycap: 6"
      },
      {
        "number": 1398,
        "code": "U+0037 U+FE0F U+20E3",
        "browser": "7️⃣",
        "shortname": "keycap: 7"
      },
      {
        "number": 1399,
        "code": "U+0038 U+FE0F U+20E3",
        "browser": "8️⃣",
        "shortname": "keycap: 8"
      },
      {
        "number": 1400,
        "code": "U+0039 U+FE0F U+20E3",
        "browser": "9️⃣",
        "shortname": "keycap: 9"
      },
      {
        "number": 1401,
        "code": "U+1F51F",
        "browser": "🔟",
        "shortname": "keycap: 10"
      },
      {
        "number": 1402,
        "code": "U+1F520",
        "browser": "🔠",
        "shortname": "input latin uppercase"
      },
      {
        "number": 1403,
        "code": "U+1F521",
        "browser": "🔡",
        "shortname": "input latin lowercase"
      },
      {
        "number": 1404,
        "code": "U+1F522",
        "browser": "🔢",
        "shortname": "input numbers"
      },
      {
        "number": 1405,
        "code": "U+1F523",
        "browser": "🔣",
        "shortname": "input symbols"
      },
      {
        "number": 1406,
        "code": "U+1F524",
        "browser": "🔤",
        "shortname": "input latin letters"
      },
      {
        "number": 1407,
        "code": "U+1F170",
        "browser": "🅰",
        "shortname": "A button (blood type)"
      },
      {
        "number": 1408,
        "code": "U+1F18E",
        "browser": "🆎",
        "shortname": "AB button (blood type)"
      },
      {
        "number": 1409,
        "code": "U+1F171",
        "browser": "🅱",
        "shortname": "B button (blood type)"
      },
      {
        "number": 1410,
        "code": "U+1F191",
        "browser": "🆑",
        "shortname": "CL button"
      },
      {
        "number": 1411,
        "code": "U+1F192",
        "browser": "🆒",
        "shortname": "COOL button"
      },
      {
        "number": 1412,
        "code": "U+1F193",
        "browser": "🆓",
        "shortname": "FREE button"
      },
      {
        "number": 1413,
        "code": "U+2139",
        "browser": "ℹ",
        "shortname": "information"
      },
      {
        "number": 1414,
        "code": "U+1F194",
        "browser": "🆔",
        "shortname": "ID button"
      },
      {
        "number": 1415,
        "code": "U+24C2",
        "browser": "Ⓜ",
        "shortname": "circled M"
      },
      {
        "number": 1416,
        "code": "U+1F195",
        "browser": "🆕",
        "shortname": "NEW button"
      },
      {
        "number": 1417,
        "code": "U+1F196",
        "browser": "🆖",
        "shortname": "NG button"
      },
      {
        "number": 1418,
        "code": "U+1F17E",
        "browser": "🅾",
        "shortname": "O button (blood type)"
      },
      {
        "number": 1419,
        "code": "U+1F197",
        "browser": "🆗",
        "shortname": "OK button"
      },
      {
        "number": 1420,
        "code": "U+1F17F",
        "browser": "🅿",
        "shortname": "P button"
      },
      {
        "number": 1421,
        "code": "U+1F198",
        "browser": "🆘",
        "shortname": "SOS button"
      },
      {
        "number": 1422,
        "code": "U+1F199",
        "browser": "🆙",
        "shortname": "UP! button"
      },
      {
        "number": 1423,
        "code": "U+1F19A",
        "browser": "🆚",
        "shortname": "VS button"
      },
      {
        "number": 1424,
        "code": "U+1F201",
        "browser": "🈁",
        "shortname": "Japanese “here” button"
      },
      {
        "number": 1425,
        "code": "U+1F202",
        "browser": "🈂",
        "shortname": "Japanese “service charge” button"
      },
      {
        "number": 1426,
        "code": "U+1F237",
        "browser": "🈷",
        "shortname": "Japanese “monthly amount” button"
      },
      {
        "number": 1427,
        "code": "U+1F236",
        "browser": "🈶",
        "shortname": "Japanese “not free of charge” button"
      },
      {
        "number": 1428,
        "code": "U+1F22F",
        "browser": "🈯",
        "shortname": "Japanese “reserved” button"
      },
      {
        "number": 1429,
        "code": "U+1F250",
        "browser": "🉐",
        "shortname": "Japanese “bargain” button"
      },
      {
        "number": 1430,
        "code": "U+1F239",
        "browser": "🈹",
        "shortname": "Japanese “discount” button"
      },
      {
        "number": 1431,
        "code": "U+1F21A",
        "browser": "🈚",
        "shortname": "Japanese “free of charge” button"
      },
      {
        "number": 1432,
        "code": "U+1F232",
        "browser": "🈲",
        "shortname": "Japanese “prohibited” button"
      },
      {
        "number": 1433,
        "code": "U+1F251",
        "browser": "🉑",
        "shortname": "Japanese “acceptable” button"
      },
      {
        "number": 1434,
        "code": "U+1F238",
        "browser": "🈸",
        "shortname": "Japanese “application” button"
      },
      {
        "number": 1435,
        "code": "U+1F234",
        "browser": "🈴",
        "shortname": "Japanese “passing grade” button"
      },
      {
        "number": 1436,
        "code": "U+1F233",
        "browser": "🈳",
        "shortname": "Japanese “vacancy” button"
      },
      {
        "number": 1437,
        "code": "U+3297",
        "browser": "㊗",
        "shortname": "Japanese “congratulations” button"
      },
      {
        "number": 1438,
        "code": "U+3299",
        "browser": "㊙",
        "shortname": "Japanese “secret” button"
      },
      {
        "number": 1439,
        "code": "U+1F23A",
        "browser": "🈺",
        "shortname": "Japanese “open for business” button"
      },
      {
        "number": 1440,
        "code": "U+1F235",
        "browser": "🈵",
        "shortname": "Japanese “no vacancy” button"
      },
      {
        "number": 1441,
        "code": "U+1F534",
        "browser": "🔴",
        "shortname": "red circle"
      },
      {
        "number": 1445,
        "code": "U+1F535",
        "browser": "🔵",
        "shortname": "blue circle"
      },
      {
        "number": 1448,
        "code": "U+26AB",
        "browser": "⚫",
        "shortname": "black circle"
      },
      {
        "number": 1449,
        "code": "U+26AA",
        "browser": "⚪",
        "shortname": "white circle"
      },
      {
        "number": 1457,
        "code": "U+2B1B",
        "browser": "⬛",
        "shortname": "black large square"
      },
      {
        "number": 1458,
        "code": "U+2B1C",
        "browser": "⬜",
        "shortname": "white large square"
      },
      {
        "number": 1459,
        "code": "U+25FC",
        "browser": "◼",
        "shortname": "black medium square"
      },
      {
        "number": 1460,
        "code": "U+25FB",
        "browser": "◻",
        "shortname": "white medium square"
      },
      {
        "number": 1461,
        "code": "U+25FE",
        "browser": "◾",
        "shortname": "black medium-small square"
      },
      {
        "number": 1462,
        "code": "U+25FD",
        "browser": "◽",
        "shortname": "white medium-small square"
      },
      {
        "number": 1463,
        "code": "U+25AA",
        "browser": "▪",
        "shortname": "black small square"
      },
      {
        "number": 1464,
        "code": "U+25AB",
        "browser": "▫",
        "shortname": "white small square"
      },
      {
        "number": 1465,
        "code": "U+1F536",
        "browser": "🔶",
        "shortname": "large orange diamond"
      },
      {
        "number": 1466,
        "code": "U+1F537",
        "browser": "🔷",
        "shortname": "large blue diamond"
      },
      {
        "number": 1467,
        "code": "U+1F538",
        "browser": "🔸",
        "shortname": "small orange diamond"
      },
      {
        "number": 1468,
        "code": "U+1F539",
        "browser": "🔹",
        "shortname": "small blue diamond"
      },
      {
        "number": 1469,
        "code": "U+1F53A",
        "browser": "🔺",
        "shortname": "red triangle pointed up"
      },
      {
        "number": 1470,
        "code": "U+1F53B",
        "browser": "🔻",
        "shortname": "red triangle pointed down"
      },
      {
        "number": 1471,
        "code": "U+1F4A0",
        "browser": "💠",
        "shortname": "diamond with a dot"
      },
      {
        "number": 1472,
        "code": "U+1F518",
        "browser": "🔘",
        "shortname": "radio button"
      },
      {
        "number": 1473,
        "code": "U+1F533",
        "browser": "🔳",
        "shortname": "white square button"
      },
      {
        "number": 1474,
        "code": "U+1F532",
        "browser": "🔲",
        "shortname": "black square button"
      },
      {
        "number": 1475,
        "code": "U+1F3C1",
        "browser": "🏁",
        "shortname": "chequered flag"
      },
      {
        "number": 1476,
        "code": "U+1F6A9",
        "browser": "🚩",
        "shortname": "triangular flag"
      },
      {
        "number": 1477,
        "code": "U+1F38C",
        "browser": "🎌",
        "shortname": "crossed flags"
      },
      {
        "number": 1478,
        "code": "U+1F3F4",
        "browser": "🏴",
        "shortname": "black flag"
      },
      {
        "number": 1479,
        "code": "U+1F3F3",
        "browser": "🏳",
        "shortname": "white flag"
      },
      {
        "number": 1480,
        "code": "U+1F3F3 U+FE0F U+200D U+1F308",
        "browser": "🏳️‍🌈",
        "shortname": "rainbow flag"
      },
      {
        "number": 1481,
        "code": "U+1F3F4 U+200D U+2620 U+FE0F",
        "browser": "🏴‍☠️",
        "shortname": "pirate flag"
      },
      {
        "number": 1482,
        "code": "U+1F1E6 U+1F1E8",
        "browser": "🇦🇨",
        "shortname": "flag: Ascension Island"
      },
      {
        "number": 1483,
        "code": "U+1F1E6 U+1F1E9",
        "browser": "🇦🇩",
        "shortname": "flag: Andorra"
      },
      {
        "number": 1484,
        "code": "U+1F1E6 U+1F1EA",
        "browser": "🇦🇪",
        "shortname": "flag: United Arab Emirates"
      },
      {
        "number": 1485,
        "code": "U+1F1E6 U+1F1EB",
        "browser": "🇦🇫",
        "shortname": "flag: Afghanistan"
      },
      {
        "number": 1486,
        "code": "U+1F1E6 U+1F1EC",
        "browser": "🇦🇬",
        "shortname": "flag: Antigua & Barbuda"
      },
      {
        "number": 1487,
        "code": "U+1F1E6 U+1F1EE",
        "browser": "🇦🇮",
        "shortname": "flag: Anguilla"
      },
      {
        "number": 1488,
        "code": "U+1F1E6 U+1F1F1",
        "browser": "🇦🇱",
        "shortname": "flag: Albania"
      },
      {
        "number": 1489,
        "code": "U+1F1E6 U+1F1F2",
        "browser": "🇦🇲",
        "shortname": "flag: Armenia"
      },
      {
        "number": 1490,
        "code": "U+1F1E6 U+1F1F4",
        "browser": "🇦🇴",
        "shortname": "flag: Angola"
      },
      {
        "number": 1491,
        "code": "U+1F1E6 U+1F1F6",
        "browser": "🇦🇶",
        "shortname": "flag: Antarctica"
      },
      {
        "number": 1492,
        "code": "U+1F1E6 U+1F1F7",
        "browser": "🇦🇷",
        "shortname": "flag: Argentina"
      },
      {
        "number": 1493,
        "code": "U+1F1E6 U+1F1F8",
        "browser": "🇦🇸",
        "shortname": "flag: American Samoa"
      },
      {
        "number": 1494,
        "code": "U+1F1E6 U+1F1F9",
        "browser": "🇦🇹",
        "shortname": "flag: Austria"
      },
      {
        "number": 1495,
        "code": "U+1F1E6 U+1F1FA",
        "browser": "🇦🇺",
        "shortname": "flag: Australia"
      },
      {
        "number": 1496,
        "code": "U+1F1E6 U+1F1FC",
        "browser": "🇦🇼",
        "shortname": "flag: Aruba"
      },
      {
        "number": 1497,
        "code": "U+1F1E6 U+1F1FD",
        "browser": "🇦🇽",
        "shortname": "flag: Åland Islands"
      },
      {
        "number": 1498,
        "code": "U+1F1E6 U+1F1FF",
        "browser": "🇦🇿",
        "shortname": "flag: Azerbaijan"
      },
      {
        "number": 1499,
        "code": "U+1F1E7 U+1F1E6",
        "browser": "🇧🇦",
        "shortname": "flag: Bosnia & Herzegovina"
      },
      {
        "number": 1500,
        "code": "U+1F1E7 U+1F1E7",
        "browser": "🇧🇧",
        "shortname": "flag: Barbados"
      },
      {
        "number": 1501,
        "code": "U+1F1E7 U+1F1E9",
        "browser": "🇧🇩",
        "shortname": "flag: Bangladesh"
      },
      {
        "number": 1502,
        "code": "U+1F1E7 U+1F1EA",
        "browser": "🇧🇪",
        "shortname": "flag: Belgium"
      },
      {
        "number": 1503,
        "code": "U+1F1E7 U+1F1EB",
        "browser": "🇧🇫",
        "shortname": "flag: Burkina Faso"
      },
      {
        "number": 1504,
        "code": "U+1F1E7 U+1F1EC",
        "browser": "🇧🇬",
        "shortname": "flag: Bulgaria"
      },
      {
        "number": 1505,
        "code": "U+1F1E7 U+1F1ED",
        "browser": "🇧🇭",
        "shortname": "flag: Bahrain"
      },
      {
        "number": 1506,
        "code": "U+1F1E7 U+1F1EE",
        "browser": "🇧🇮",
        "shortname": "flag: Burundi"
      },
      {
        "number": 1507,
        "code": "U+1F1E7 U+1F1EF",
        "browser": "🇧🇯",
        "shortname": "flag: Benin"
      },
      {
        "number": 1508,
        "code": "U+1F1E7 U+1F1F1",
        "browser": "🇧🇱",
        "shortname": "flag: St. Barthélemy"
      },
      {
        "number": 1509,
        "code": "U+1F1E7 U+1F1F2",
        "browser": "🇧🇲",
        "shortname": "flag: Bermuda"
      },
      {
        "number": 1510,
        "code": "U+1F1E7 U+1F1F3",
        "browser": "🇧🇳",
        "shortname": "flag: Brunei"
      },
      {
        "number": 1511,
        "code": "U+1F1E7 U+1F1F4",
        "browser": "🇧🇴",
        "shortname": "flag: Bolivia"
      },
      {
        "number": 1512,
        "code": "U+1F1E7 U+1F1F6",
        "browser": "🇧🇶",
        "shortname": "flag: Caribbean Netherlands"
      },
      {
        "number": 1513,
        "code": "U+1F1E7 U+1F1F7",
        "browser": "🇧🇷",
        "shortname": "flag: Brazil"
      },
      {
        "number": 1514,
        "code": "U+1F1E7 U+1F1F8",
        "browser": "🇧🇸",
        "shortname": "flag: Bahamas"
      },
      {
        "number": 1515,
        "code": "U+1F1E7 U+1F1F9",
        "browser": "🇧🇹",
        "shortname": "flag: Bhutan"
      },
      {
        "number": 1516,
        "code": "U+1F1E7 U+1F1FB",
        "browser": "🇧🇻",
        "shortname": "flag: Bouvet Island"
      },
      {
        "number": 1517,
        "code": "U+1F1E7 U+1F1FC",
        "browser": "🇧🇼",
        "shortname": "flag: Botswana"
      },
      {
        "number": 1518,
        "code": "U+1F1E7 U+1F1FE",
        "browser": "🇧🇾",
        "shortname": "flag: Belarus"
      },
      {
        "number": 1519,
        "code": "U+1F1E7 U+1F1FF",
        "browser": "🇧🇿",
        "shortname": "flag: Belize"
      },
      {
        "number": 1520,
        "code": "U+1F1E8 U+1F1E6",
        "browser": "🇨🇦",
        "shortname": "flag: Canada"
      },
      {
        "number": 1521,
        "code": "U+1F1E8 U+1F1E8",
        "browser": "🇨🇨",
        "shortname": "flag: Cocos (Keeling) Islands"
      },
      {
        "number": 1522,
        "code": "U+1F1E8 U+1F1E9",
        "browser": "🇨🇩",
        "shortname": "flag: Congo - Kinshasa"
      },
      {
        "number": 1523,
        "code": "U+1F1E8 U+1F1EB",
        "browser": "🇨🇫",
        "shortname": "flag: Central African Republic"
      },
      {
        "number": 1524,
        "code": "U+1F1E8 U+1F1EC",
        "browser": "🇨🇬",
        "shortname": "flag: Congo - Brazzaville"
      },
      {
        "number": 1525,
        "code": "U+1F1E8 U+1F1ED",
        "browser": "🇨🇭",
        "shortname": "flag: Switzerland"
      },
      {
        "number": 1526,
        "code": "U+1F1E8 U+1F1EE",
        "browser": "🇨🇮",
        "shortname": "flag: Côte d’Ivoire"
      },
      {
        "number": 1527,
        "code": "U+1F1E8 U+1F1F0",
        "browser": "🇨🇰",
        "shortname": "flag: Cook Islands"
      },
      {
        "number": 1528,
        "code": "U+1F1E8 U+1F1F1",
        "browser": "🇨🇱",
        "shortname": "flag: Chile"
      },
      {
        "number": 1529,
        "code": "U+1F1E8 U+1F1F2",
        "browser": "🇨🇲",
        "shortname": "flag: Cameroon"
      },
      {
        "number": 1530,
        "code": "U+1F1E8 U+1F1F3",
        "browser": "🇨🇳",
        "shortname": "flag: China"
      },
      {
        "number": 1531,
        "code": "U+1F1E8 U+1F1F4",
        "browser": "🇨🇴",
        "shortname": "flag: Colombia"
      },
      {
        "number": 1532,
        "code": "U+1F1E8 U+1F1F5",
        "browser": "🇨🇵",
        "shortname": "flag: Clipperton Island"
      },
      {
        "number": 1533,
        "code": "U+1F1E8 U+1F1F7",
        "browser": "🇨🇷",
        "shortname": "flag: Costa Rica"
      },
      {
        "number": 1534,
        "code": "U+1F1E8 U+1F1FA",
        "browser": "🇨🇺",
        "shortname": "flag: Cuba"
      },
      {
        "number": 1535,
        "code": "U+1F1E8 U+1F1FB",
        "browser": "🇨🇻",
        "shortname": "flag: Cape Verde"
      },
      {
        "number": 1536,
        "code": "U+1F1E8 U+1F1FC",
        "browser": "🇨🇼",
        "shortname": "flag: Curaçao"
      },
      {
        "number": 1537,
        "code": "U+1F1E8 U+1F1FD",
        "browser": "🇨🇽",
        "shortname": "flag: Christmas Island"
      },
      {
        "number": 1538,
        "code": "U+1F1E8 U+1F1FE",
        "browser": "🇨🇾",
        "shortname": "flag: Cyprus"
      },
      {
        "number": 1539,
        "code": "U+1F1E8 U+1F1FF",
        "browser": "🇨🇿",
        "shortname": "flag: Czechia"
      },
      {
        "number": 1540,
        "code": "U+1F1E9 U+1F1EA",
        "browser": "🇩🇪",
        "shortname": "flag: Germany"
      },
      {
        "number": 1541,
        "code": "U+1F1E9 U+1F1EC",
        "browser": "🇩🇬",
        "shortname": "flag: Diego Garcia"
      },
      {
        "number": 1542,
        "code": "U+1F1E9 U+1F1EF",
        "browser": "🇩🇯",
        "shortname": "flag: Djibouti"
      },
      {
        "number": 1543,
        "code": "U+1F1E9 U+1F1F0",
        "browser": "🇩🇰",
        "shortname": "flag: Denmark"
      },
      {
        "number": 1544,
        "code": "U+1F1E9 U+1F1F2",
        "browser": "🇩🇲",
        "shortname": "flag: Dominica"
      },
      {
        "number": 1545,
        "code": "U+1F1E9 U+1F1F4",
        "browser": "🇩🇴",
        "shortname": "flag: Dominican Republic"
      },
      {
        "number": 1546,
        "code": "U+1F1E9 U+1F1FF",
        "browser": "🇩🇿",
        "shortname": "flag: Algeria"
      },
      {
        "number": 1547,
        "code": "U+1F1EA U+1F1E6",
        "browser": "🇪🇦",
        "shortname": "flag: Ceuta & Melilla"
      },
      {
        "number": 1548,
        "code": "U+1F1EA U+1F1E8",
        "browser": "🇪🇨",
        "shortname": "flag: Ecuador"
      },
      {
        "number": 1549,
        "code": "U+1F1EA U+1F1EA",
        "browser": "🇪🇪",
        "shortname": "flag: Estonia"
      },
      {
        "number": 1550,
        "code": "U+1F1EA U+1F1EC",
        "browser": "🇪🇬",
        "shortname": "flag: Egypt"
      },
      {
        "number": 1551,
        "code": "U+1F1EA U+1F1ED",
        "browser": "🇪🇭",
        "shortname": "flag: Western Sahara"
      },
      {
        "number": 1552,
        "code": "U+1F1EA U+1F1F7",
        "browser": "🇪🇷",
        "shortname": "flag: Eritrea"
      },
      {
        "number": 1553,
        "code": "U+1F1EA U+1F1F8",
        "browser": "🇪🇸",
        "shortname": "flag: Spain"
      },
      {
        "number": 1554,
        "code": "U+1F1EA U+1F1F9",
        "browser": "🇪🇹",
        "shortname": "flag: Ethiopia"
      },
      {
        "number": 1555,
        "code": "U+1F1EA U+1F1FA",
        "browser": "🇪🇺",
        "shortname": "flag: European Union"
      },
      {
        "number": 1556,
        "code": "U+1F1EB U+1F1EE",
        "browser": "🇫🇮",
        "shortname": "flag: Finland"
      },
      {
        "number": 1557,
        "code": "U+1F1EB U+1F1EF",
        "browser": "🇫🇯",
        "shortname": "flag: Fiji"
      },
      {
        "number": 1558,
        "code": "U+1F1EB U+1F1F0",
        "browser": "🇫🇰",
        "shortname": "flag: Falkland Islands"
      },
      {
        "number": 1559,
        "code": "U+1F1EB U+1F1F2",
        "browser": "🇫🇲",
        "shortname": "flag: Micronesia"
      },
      {
        "number": 1560,
        "code": "U+1F1EB U+1F1F4",
        "browser": "🇫🇴",
        "shortname": "flag: Faroe Islands"
      },
      {
        "number": 1561,
        "code": "U+1F1EB U+1F1F7",
        "browser": "🇫🇷",
        "shortname": "flag: France"
      },
      {
        "number": 1562,
        "code": "U+1F1EC U+1F1E6",
        "browser": "🇬🇦",
        "shortname": "flag: Gabon"
      },
      {
        "number": 1563,
        "code": "U+1F1EC U+1F1E7",
        "browser": "🇬🇧",
        "shortname": "flag: United Kingdom"
      },
      {
        "number": 1564,
        "code": "U+1F1EC U+1F1E9",
        "browser": "🇬🇩",
        "shortname": "flag: Grenada"
      },
      {
        "number": 1565,
        "code": "U+1F1EC U+1F1EA",
        "browser": "🇬🇪",
        "shortname": "flag: Georgia"
      },
      {
        "number": 1566,
        "code": "U+1F1EC U+1F1EB",
        "browser": "🇬🇫",
        "shortname": "flag: French Guiana"
      },
      {
        "number": 1567,
        "code": "U+1F1EC U+1F1EC",
        "browser": "🇬🇬",
        "shortname": "flag: Guernsey"
      },
      {
        "number": 1568,
        "code": "U+1F1EC U+1F1ED",
        "browser": "🇬🇭",
        "shortname": "flag: Ghana"
      },
      {
        "number": 1569,
        "code": "U+1F1EC U+1F1EE",
        "browser": "🇬🇮",
        "shortname": "flag: Gibraltar"
      },
      {
        "number": 1570,
        "code": "U+1F1EC U+1F1F1",
        "browser": "🇬🇱",
        "shortname": "flag: Greenland"
      },
      {
        "number": 1571,
        "code": "U+1F1EC U+1F1F2",
        "browser": "🇬🇲",
        "shortname": "flag: Gambia"
      },
      {
        "number": 1572,
        "code": "U+1F1EC U+1F1F3",
        "browser": "🇬🇳",
        "shortname": "flag: Guinea"
      },
      {
        "number": 1573,
        "code": "U+1F1EC U+1F1F5",
        "browser": "🇬🇵",
        "shortname": "flag: Guadeloupe"
      },
      {
        "number": 1574,
        "code": "U+1F1EC U+1F1F6",
        "browser": "🇬🇶",
        "shortname": "flag: Equatorial Guinea"
      },
      {
        "number": 1575,
        "code": "U+1F1EC U+1F1F7",
        "browser": "🇬🇷",
        "shortname": "flag: Greece"
      },
      {
        "number": 1576,
        "code": "U+1F1EC U+1F1F8",
        "browser": "🇬🇸",
        "shortname": "flag: South Georgia & South Sandwich Islands"
      },
      {
        "number": 1577,
        "code": "U+1F1EC U+1F1F9",
        "browser": "🇬🇹",
        "shortname": "flag: Guatemala"
      },
      {
        "number": 1578,
        "code": "U+1F1EC U+1F1FA",
        "browser": "🇬🇺",
        "shortname": "flag: Guam"
      },
      {
        "number": 1579,
        "code": "U+1F1EC U+1F1FC",
        "browser": "🇬🇼",
        "shortname": "flag: Guinea-Bissau"
      },
      {
        "number": 1580,
        "code": "U+1F1EC U+1F1FE",
        "browser": "🇬🇾",
        "shortname": "flag: Guyana"
      },
      {
        "number": 1581,
        "code": "U+1F1ED U+1F1F0",
        "browser": "🇭🇰",
        "shortname": "flag: Hong Kong SAR China"
      },
      {
        "number": 1582,
        "code": "U+1F1ED U+1F1F2",
        "browser": "🇭🇲",
        "shortname": "flag: Heard & McDonald Islands"
      },
      {
        "number": 1583,
        "code": "U+1F1ED U+1F1F3",
        "browser": "🇭🇳",
        "shortname": "flag: Honduras"
      },
      {
        "number": 1584,
        "code": "U+1F1ED U+1F1F7",
        "browser": "🇭🇷",
        "shortname": "flag: Croatia"
      },
      {
        "number": 1585,
        "code": "U+1F1ED U+1F1F9",
        "browser": "🇭🇹",
        "shortname": "flag: Haiti"
      },
      {
        "number": 1586,
        "code": "U+1F1ED U+1F1FA",
        "browser": "🇭🇺",
        "shortname": "flag: Hungary"
      },
      {
        "number": 1587,
        "code": "U+1F1EE U+1F1E8",
        "browser": "🇮🇨",
        "shortname": "flag: Canary Islands"
      },
      {
        "number": 1588,
        "code": "U+1F1EE U+1F1E9",
        "browser": "🇮🇩",
        "shortname": "flag: Indonesia"
      },
      {
        "number": 1589,
        "code": "U+1F1EE U+1F1EA",
        "browser": "🇮🇪",
        "shortname": "flag: Ireland"
      },
      {
        "number": 1590,
        "code": "U+1F1EE U+1F1F1",
        "browser": "🇮🇱",
        "shortname": "flag: Israel"
      },
      {
        "number": 1591,
        "code": "U+1F1EE U+1F1F2",
        "browser": "🇮🇲",
        "shortname": "flag: Isle of Man"
      },
      {
        "number": 1592,
        "code": "U+1F1EE U+1F1F3",
        "browser": "🇮🇳",
        "shortname": "flag: India"
      },
      {
        "number": 1593,
        "code": "U+1F1EE U+1F1F4",
        "browser": "🇮🇴",
        "shortname": "flag: British Indian Ocean Territory"
      },
      {
        "number": 1594,
        "code": "U+1F1EE U+1F1F6",
        "browser": "🇮🇶",
        "shortname": "flag: Iraq"
      },
      {
        "number": 1595,
        "code": "U+1F1EE U+1F1F7",
        "browser": "🇮🇷",
        "shortname": "flag: Iran"
      },
      {
        "number": 1596,
        "code": "U+1F1EE U+1F1F8",
        "browser": "🇮🇸",
        "shortname": "flag: Iceland"
      },
      {
        "number": 1597,
        "code": "U+1F1EE U+1F1F9",
        "browser": "🇮🇹",
        "shortname": "flag: Italy"
      },
      {
        "number": 1598,
        "code": "U+1F1EF U+1F1EA",
        "browser": "🇯🇪",
        "shortname": "flag: Jersey"
      },
      {
        "number": 1599,
        "code": "U+1F1EF U+1F1F2",
        "browser": "🇯🇲",
        "shortname": "flag: Jamaica"
      },
      {
        "number": 1600,
        "code": "U+1F1EF U+1F1F4",
        "browser": "🇯🇴",
        "shortname": "flag: Jordan"
      },
      {
        "number": 1601,
        "code": "U+1F1EF U+1F1F5",
        "browser": "🇯🇵",
        "shortname": "flag: Japan"
      },
      {
        "number": 1602,
        "code": "U+1F1F0 U+1F1EA",
        "browser": "🇰🇪",
        "shortname": "flag: Kenya"
      },
      {
        "number": 1603,
        "code": "U+1F1F0 U+1F1EC",
        "browser": "🇰🇬",
        "shortname": "flag: Kyrgyzstan"
      },
      {
        "number": 1604,
        "code": "U+1F1F0 U+1F1ED",
        "browser": "🇰🇭",
        "shortname": "flag: Cambodia"
      },
      {
        "number": 1605,
        "code": "U+1F1F0 U+1F1EE",
        "browser": "🇰🇮",
        "shortname": "flag: Kiribati"
      },
      {
        "number": 1606,
        "code": "U+1F1F0 U+1F1F2",
        "browser": "🇰🇲",
        "shortname": "flag: Comoros"
      },
      {
        "number": 1607,
        "code": "U+1F1F0 U+1F1F3",
        "browser": "🇰🇳",
        "shortname": "flag: St. Kitts & Nevis"
      },
      {
        "number": 1608,
        "code": "U+1F1F0 U+1F1F5",
        "browser": "🇰🇵",
        "shortname": "flag: North Korea"
      },
      {
        "number": 1609,
        "code": "U+1F1F0 U+1F1F7",
        "browser": "🇰🇷",
        "shortname": "flag: South Korea"
      },
      {
        "number": 1610,
        "code": "U+1F1F0 U+1F1FC",
        "browser": "🇰🇼",
        "shortname": "flag: Kuwait"
      },
      {
        "number": 1611,
        "code": "U+1F1F0 U+1F1FE",
        "browser": "🇰🇾",
        "shortname": "flag: Cayman Islands"
      },
      {
        "number": 1612,
        "code": "U+1F1F0 U+1F1FF",
        "browser": "🇰🇿",
        "shortname": "flag: Kazakhstan"
      },
      {
        "number": 1613,
        "code": "U+1F1F1 U+1F1E6",
        "browser": "🇱🇦",
        "shortname": "flag: Laos"
      },
      {
        "number": 1614,
        "code": "U+1F1F1 U+1F1E7",
        "browser": "🇱🇧",
        "shortname": "flag: Lebanon"
      },
      {
        "number": 1615,
        "code": "U+1F1F1 U+1F1E8",
        "browser": "🇱🇨",
        "shortname": "flag: St. Lucia"
      },
      {
        "number": 1616,
        "code": "U+1F1F1 U+1F1EE",
        "browser": "🇱🇮",
        "shortname": "flag: Liechtenstein"
      },
      {
        "number": 1617,
        "code": "U+1F1F1 U+1F1F0",
        "browser": "🇱🇰",
        "shortname": "flag: Sri Lanka"
      },
      {
        "number": 1618,
        "code": "U+1F1F1 U+1F1F7",
        "browser": "🇱🇷",
        "shortname": "flag: Liberia"
      },
      {
        "number": 1619,
        "code": "U+1F1F1 U+1F1F8",
        "browser": "🇱🇸",
        "shortname": "flag: Lesotho"
      },
      {
        "number": 1620,
        "code": "U+1F1F1 U+1F1F9",
        "browser": "🇱🇹",
        "shortname": "flag: Lithuania"
      },
      {
        "number": 1621,
        "code": "U+1F1F1 U+1F1FA",
        "browser": "🇱🇺",
        "shortname": "flag: Luxembourg"
      },
      {
        "number": 1622,
        "code": "U+1F1F1 U+1F1FB",
        "browser": "🇱🇻",
        "shortname": "flag: Latvia"
      },
      {
        "number": 1623,
        "code": "U+1F1F1 U+1F1FE",
        "browser": "🇱🇾",
        "shortname": "flag: Libya"
      },
      {
        "number": 1624,
        "code": "U+1F1F2 U+1F1E6",
        "browser": "🇲🇦",
        "shortname": "flag: Morocco"
      },
      {
        "number": 1625,
        "code": "U+1F1F2 U+1F1E8",
        "browser": "🇲🇨",
        "shortname": "flag: Monaco"
      },
      {
        "number": 1626,
        "code": "U+1F1F2 U+1F1E9",
        "browser": "🇲🇩",
        "shortname": "flag: Moldova"
      },
      {
        "number": 1627,
        "code": "U+1F1F2 U+1F1EA",
        "browser": "🇲🇪",
        "shortname": "flag: Montenegro"
      },
      {
        "number": 1628,
        "code": "U+1F1F2 U+1F1EB",
        "browser": "🇲🇫",
        "shortname": "flag: St. Martin"
      },
      {
        "number": 1629,
        "code": "U+1F1F2 U+1F1EC",
        "browser": "🇲🇬",
        "shortname": "flag: Madagascar"
      },
      {
        "number": 1630,
        "code": "U+1F1F2 U+1F1ED",
        "browser": "🇲🇭",
        "shortname": "flag: Marshall Islands"
      },
      {
        "number": 1631,
        "code": "U+1F1F2 U+1F1F0",
        "browser": "🇲🇰",
        "shortname": "flag: North Macedonia"
      },
      {
        "number": 1632,
        "code": "U+1F1F2 U+1F1F1",
        "browser": "🇲🇱",
        "shortname": "flag: Mali"
      },
      {
        "number": 1633,
        "code": "U+1F1F2 U+1F1F2",
        "browser": "🇲🇲",
        "shortname": "flag: Myanmar (Burma)"
      },
      {
        "number": 1634,
        "code": "U+1F1F2 U+1F1F3",
        "browser": "🇲🇳",
        "shortname": "flag: Mongolia"
      },
      {
        "number": 1635,
        "code": "U+1F1F2 U+1F1F4",
        "browser": "🇲🇴",
        "shortname": "flag: Macao SAR China"
      },
      {
        "number": 1636,
        "code": "U+1F1F2 U+1F1F5",
        "browser": "🇲🇵",
        "shortname": "flag: Northern Mariana Islands"
      },
      {
        "number": 1637,
        "code": "U+1F1F2 U+1F1F6",
        "browser": "🇲🇶",
        "shortname": "flag: Martinique"
      },
      {
        "number": 1638,
        "code": "U+1F1F2 U+1F1F7",
        "browser": "🇲🇷",
        "shortname": "flag: Mauritania"
      },
      {
        "number": 1639,
        "code": "U+1F1F2 U+1F1F8",
        "browser": "🇲🇸",
        "shortname": "flag: Montserrat"
      },
      {
        "number": 1640,
        "code": "U+1F1F2 U+1F1F9",
        "browser": "🇲🇹",
        "shortname": "flag: Malta"
      },
      {
        "number": 1641,
        "code": "U+1F1F2 U+1F1FA",
        "browser": "🇲🇺",
        "shortname": "flag: Mauritius"
      },
      {
        "number": 1642,
        "code": "U+1F1F2 U+1F1FB",
        "browser": "🇲🇻",
        "shortname": "flag: Maldives"
      },
      {
        "number": 1643,
        "code": "U+1F1F2 U+1F1FC",
        "browser": "🇲🇼",
        "shortname": "flag: Malawi"
      },
      {
        "number": 1644,
        "code": "U+1F1F2 U+1F1FD",
        "browser": "🇲🇽",
        "shortname": "flag: Mexico"
      },
      {
        "number": 1645,
        "code": "U+1F1F2 U+1F1FE",
        "browser": "🇲🇾",
        "shortname": "flag: Malaysia"
      },
      {
        "number": 1646,
        "code": "U+1F1F2 U+1F1FF",
        "browser": "🇲🇿",
        "shortname": "flag: Mozambique"
      },
      {
        "number": 1647,
        "code": "U+1F1F3 U+1F1E6",
        "browser": "🇳🇦",
        "shortname": "flag: Namibia"
      },
      {
        "number": 1648,
        "code": "U+1F1F3 U+1F1E8",
        "browser": "🇳🇨",
        "shortname": "flag: New Caledonia"
      },
      {
        "number": 1649,
        "code": "U+1F1F3 U+1F1EA",
        "browser": "🇳🇪",
        "shortname": "flag: Niger"
      },
      {
        "number": 1650,
        "code": "U+1F1F3 U+1F1EB",
        "browser": "🇳🇫",
        "shortname": "flag: Norfolk Island"
      },
      {
        "number": 1651,
        "code": "U+1F1F3 U+1F1EC",
        "browser": "🇳🇬",
        "shortname": "flag: Nigeria"
      },
      {
        "number": 1652,
        "code": "U+1F1F3 U+1F1EE",
        "browser": "🇳🇮",
        "shortname": "flag: Nicaragua"
      },
      {
        "number": 1653,
        "code": "U+1F1F3 U+1F1F1",
        "browser": "🇳🇱",
        "shortname": "flag: Netherlands"
      },
      {
        "number": 1654,
        "code": "U+1F1F3 U+1F1F4",
        "browser": "🇳🇴",
        "shortname": "flag: Norway"
      },
      {
        "number": 1655,
        "code": "U+1F1F3 U+1F1F5",
        "browser": "🇳🇵",
        "shortname": "flag: Nepal"
      },
      {
        "number": 1656,
        "code": "U+1F1F3 U+1F1F7",
        "browser": "🇳🇷",
        "shortname": "flag: Nauru"
      },
      {
        "number": 1657,
        "code": "U+1F1F3 U+1F1FA",
        "browser": "🇳🇺",
        "shortname": "flag: Niue"
      },
      {
        "number": 1658,
        "code": "U+1F1F3 U+1F1FF",
        "browser": "🇳🇿",
        "shortname": "flag: New Zealand"
      },
      {
        "number": 1659,
        "code": "U+1F1F4 U+1F1F2",
        "browser": "🇴🇲",
        "shortname": "flag: Oman"
      },
      {
        "number": 1660,
        "code": "U+1F1F5 U+1F1E6",
        "browser": "🇵🇦",
        "shortname": "flag: Panama"
      },
      {
        "number": 1661,
        "code": "U+1F1F5 U+1F1EA",
        "browser": "🇵🇪",
        "shortname": "flag: Peru"
      },
      {
        "number": 1662,
        "code": "U+1F1F5 U+1F1EB",
        "browser": "🇵🇫",
        "shortname": "flag: French Polynesia"
      },
      {
        "number": 1663,
        "code": "U+1F1F5 U+1F1EC",
        "browser": "🇵🇬",
        "shortname": "flag: Papua New Guinea"
      },
      {
        "number": 1664,
        "code": "U+1F1F5 U+1F1ED",
        "browser": "🇵🇭",
        "shortname": "flag: Philippines"
      },
      {
        "number": 1665,
        "code": "U+1F1F5 U+1F1F0",
        "browser": "🇵🇰",
        "shortname": "flag: Pakistan"
      },
      {
        "number": 1666,
        "code": "U+1F1F5 U+1F1F1",
        "browser": "🇵🇱",
        "shortname": "flag: Poland"
      },
      {
        "number": 1667,
        "code": "U+1F1F5 U+1F1F2",
        "browser": "🇵🇲",
        "shortname": "flag: St. Pierre & Miquelon"
      },
      {
        "number": 1668,
        "code": "U+1F1F5 U+1F1F3",
        "browser": "🇵🇳",
        "shortname": "flag: Pitcairn Islands"
      },
      {
        "number": 1669,
        "code": "U+1F1F5 U+1F1F7",
        "browser": "🇵🇷",
        "shortname": "flag: Puerto Rico"
      },
      {
        "number": 1670,
        "code": "U+1F1F5 U+1F1F8",
        "browser": "🇵🇸",
        "shortname": "flag: Palestinian Territories"
      },
      {
        "number": 1671,
        "code": "U+1F1F5 U+1F1F9",
        "browser": "🇵🇹",
        "shortname": "flag: Portugal"
      },
      {
        "number": 1672,
        "code": "U+1F1F5 U+1F1FC",
        "browser": "🇵🇼",
        "shortname": "flag: Palau"
      },
      {
        "number": 1673,
        "code": "U+1F1F5 U+1F1FE",
        "browser": "🇵🇾",
        "shortname": "flag: Paraguay"
      },
      {
        "number": 1674,
        "code": "U+1F1F6 U+1F1E6",
        "browser": "🇶🇦",
        "shortname": "flag: Qatar"
      },
      {
        "number": 1675,
        "code": "U+1F1F7 U+1F1EA",
        "browser": "🇷🇪",
        "shortname": "flag: Réunion"
      },
      {
        "number": 1676,
        "code": "U+1F1F7 U+1F1F4",
        "browser": "🇷🇴",
        "shortname": "flag: Romania"
      },
      {
        "number": 1677,
        "code": "U+1F1F7 U+1F1F8",
        "browser": "🇷🇸",
        "shortname": "flag: Serbia"
      },
      {
        "number": 1678,
        "code": "U+1F1F7 U+1F1FA",
        "browser": "🇷🇺",
        "shortname": "flag: Russia"
      },
      {
        "number": 1679,
        "code": "U+1F1F7 U+1F1FC",
        "browser": "🇷🇼",
        "shortname": "flag: Rwanda"
      },
      {
        "number": 1680,
        "code": "U+1F1F8 U+1F1E6",
        "browser": "🇸🇦",
        "shortname": "flag: Saudi Arabia"
      },
      {
        "number": 1681,
        "code": "U+1F1F8 U+1F1E7",
        "browser": "🇸🇧",
        "shortname": "flag: Solomon Islands"
      },
      {
        "number": 1682,
        "code": "U+1F1F8 U+1F1E8",
        "browser": "🇸🇨",
        "shortname": "flag: Seychelles"
      },
      {
        "number": 1683,
        "code": "U+1F1F8 U+1F1E9",
        "browser": "🇸🇩",
        "shortname": "flag: Sudan"
      },
      {
        "number": 1684,
        "code": "U+1F1F8 U+1F1EA",
        "browser": "🇸🇪",
        "shortname": "flag: Sweden"
      },
      {
        "number": 1685,
        "code": "U+1F1F8 U+1F1EC",
        "browser": "🇸🇬",
        "shortname": "flag: Singapore"
      },
      {
        "number": 1686,
        "code": "U+1F1F8 U+1F1ED",
        "browser": "🇸🇭",
        "shortname": "flag: St. Helena"
      },
      {
        "number": 1687,
        "code": "U+1F1F8 U+1F1EE",
        "browser": "🇸🇮",
        "shortname": "flag: Slovenia"
      },
      {
        "number": 1688,
        "code": "U+1F1F8 U+1F1EF",
        "browser": "🇸🇯",
        "shortname": "flag: Svalbard & Jan Mayen"
      },
      {
        "number": 1689,
        "code": "U+1F1F8 U+1F1F0",
        "browser": "🇸🇰",
        "shortname": "flag: Slovakia"
      },
      {
        "number": 1690,
        "code": "U+1F1F8 U+1F1F1",
        "browser": "🇸🇱",
        "shortname": "flag: Sierra Leone"
      },
      {
        "number": 1691,
        "code": "U+1F1F8 U+1F1F2",
        "browser": "🇸🇲",
        "shortname": "flag: San Marino"
      },
      {
        "number": 1692,
        "code": "U+1F1F8 U+1F1F3",
        "browser": "🇸🇳",
        "shortname": "flag: Senegal"
      },
      {
        "number": 1693,
        "code": "U+1F1F8 U+1F1F4",
        "browser": "🇸🇴",
        "shortname": "flag: Somalia"
      },
      {
        "number": 1694,
        "code": "U+1F1F8 U+1F1F7",
        "browser": "🇸🇷",
        "shortname": "flag: Suriname"
      },
      {
        "number": 1695,
        "code": "U+1F1F8 U+1F1F8",
        "browser": "🇸🇸",
        "shortname": "flag: South Sudan"
      },
      {
        "number": 1696,
        "code": "U+1F1F8 U+1F1F9",
        "browser": "🇸🇹",
        "shortname": "flag: São Tomé & Príncipe"
      },
      {
        "number": 1697,
        "code": "U+1F1F8 U+1F1FB",
        "browser": "🇸🇻",
        "shortname": "flag: El Salvador"
      },
      {
        "number": 1698,
        "code": "U+1F1F8 U+1F1FD",
        "browser": "🇸🇽",
        "shortname": "flag: Sint Maarten"
      },
      {
        "number": 1699,
        "code": "U+1F1F8 U+1F1FE",
        "browser": "🇸🇾",
        "shortname": "flag: Syria"
      },
      {
        "number": 1700,
        "code": "U+1F1F8 U+1F1FF",
        "browser": "🇸🇿",
        "shortname": "flag: Eswatini"
      },
      {
        "number": 1701,
        "code": "U+1F1F9 U+1F1E6",
        "browser": "🇹🇦",
        "shortname": "flag: Tristan da Cunha"
      },
      {
        "number": 1702,
        "code": "U+1F1F9 U+1F1E8",
        "browser": "🇹🇨",
        "shortname": "flag: Turks & Caicos Islands"
      },
      {
        "number": 1703,
        "code": "U+1F1F9 U+1F1E9",
        "browser": "🇹🇩",
        "shortname": "flag: Chad"
      },
      {
        "number": 1704,
        "code": "U+1F1F9 U+1F1EB",
        "browser": "🇹🇫",
        "shortname": "flag: French Southern Territories"
      },
      {
        "number": 1705,
        "code": "U+1F1F9 U+1F1EC",
        "browser": "🇹🇬",
        "shortname": "flag: Togo"
      },
      {
        "number": 1706,
        "code": "U+1F1F9 U+1F1ED",
        "browser": "🇹🇭",
        "shortname": "flag: Thailand"
      },
      {
        "number": 1707,
        "code": "U+1F1F9 U+1F1EF",
        "browser": "🇹🇯",
        "shortname": "flag: Tajikistan"
      },
      {
        "number": 1708,
        "code": "U+1F1F9 U+1F1F0",
        "browser": "🇹🇰",
        "shortname": "flag: Tokelau"
      },
      {
        "number": 1709,
        "code": "U+1F1F9 U+1F1F1",
        "browser": "🇹🇱",
        "shortname": "flag: Timor-Leste"
      },
      {
        "number": 1710,
        "code": "U+1F1F9 U+1F1F2",
        "browser": "🇹🇲",
        "shortname": "flag: Turkmenistan"
      },
      {
        "number": 1711,
        "code": "U+1F1F9 U+1F1F3",
        "browser": "🇹🇳",
        "shortname": "flag: Tunisia"
      },
      {
        "number": 1712,
        "code": "U+1F1F9 U+1F1F4",
        "browser": "🇹🇴",
        "shortname": "flag: Tonga"
      },
      {
        "number": 1713,
        "code": "U+1F1F9 U+1F1F7",
        "browser": "🇹🇷",
        "shortname": "flag: Turkey"
      },
      {
        "number": 1714,
        "code": "U+1F1F9 U+1F1F9",
        "browser": "🇹🇹",
        "shortname": "flag: Trinidad & Tobago"
      },
      {
        "number": 1715,
        "code": "U+1F1F9 U+1F1FB",
        "browser": "🇹🇻",
        "shortname": "flag: Tuvalu"
      },
      {
        "number": 1716,
        "code": "U+1F1F9 U+1F1FC",
        "browser": "🇹🇼",
        "shortname": "flag: Taiwan"
      },
      {
        "number": 1717,
        "code": "U+1F1F9 U+1F1FF",
        "browser": "🇹🇿",
        "shortname": "flag: Tanzania"
      },
      {
        "number": 1718,
        "code": "U+1F1FA U+1F1E6",
        "browser": "🇺🇦",
        "shortname": "flag: Ukraine"
      },
      {
        "number": 1719,
        "code": "U+1F1FA U+1F1EC",
        "browser": "🇺🇬",
        "shortname": "flag: Uganda"
      },
      {
        "number": 1720,
        "code": "U+1F1FA U+1F1F2",
        "browser": "🇺🇲",
        "shortname": "flag: U.S. Outlying Islands"
      },
      {
        "number": 1721,
        "code": "U+1F1FA U+1F1F3",
        "browser": "🇺🇳",
        "shortname": "flag: United Nations"
      },
      {
        "number": 1722,
        "code": "U+1F1FA U+1F1F8",
        "browser": "🇺🇸",
        "shortname": "flag: United States"
      },
      {
        "number": 1723,
        "code": "U+1F1FA U+1F1FE",
        "browser": "🇺🇾",
        "shortname": "flag: Uruguay"
      },
      {
        "number": 1724,
        "code": "U+1F1FA U+1F1FF",
        "browser": "🇺🇿",
        "shortname": "flag: Uzbekistan"
      },
      {
        "number": 1725,
        "code": "U+1F1FB U+1F1E6",
        "browser": "🇻🇦",
        "shortname": "flag: Vatican City"
      },
      {
        "number": 1726,
        "code": "U+1F1FB U+1F1E8",
        "browser": "🇻🇨",
        "shortname": "flag: St. Vincent & Grenadines"
      },
      {
        "number": 1727,
        "code": "U+1F1FB U+1F1EA",
        "browser": "🇻🇪",
        "shortname": "flag: Venezuela"
      },
      {
        "number": 1728,
        "code": "U+1F1FB U+1F1EC",
        "browser": "🇻🇬",
        "shortname": "flag: British Virgin Islands"
      },
      {
        "number": 1729,
        "code": "U+1F1FB U+1F1EE",
        "browser": "🇻🇮",
        "shortname": "flag: U.S. Virgin Islands"
      },
      {
        "number": 1730,
        "code": "U+1F1FB U+1F1F3",
        "browser": "🇻🇳",
        "shortname": "flag: Vietnam"
      },
      {
        "number": 1731,
        "code": "U+1F1FB U+1F1FA",
        "browser": "🇻🇺",
        "shortname": "flag: Vanuatu"
      },
      {
        "number": 1732,
        "code": "U+1F1FC U+1F1EB",
        "browser": "🇼🇫",
        "shortname": "flag: Wallis & Futuna"
      },
      {
        "number": 1733,
        "code": "U+1F1FC U+1F1F8",
        "browser": "🇼🇸",
        "shortname": "flag: Samoa"
      },
      {
        "number": 1734,
        "code": "U+1F1FD U+1F1F0",
        "browser": "🇽🇰",
        "shortname": "flag: Kosovo"
      },
      {
        "number": 1735,
        "code": "U+1F1FE U+1F1EA",
        "browser": "🇾🇪",
        "shortname": "flag: Yemen"
      },
      {
        "number": 1736,
        "code": "U+1F1FE U+1F1F9",
        "browser": "🇾🇹",
        "shortname": "flag: Mayotte"
      },
      {
        "number": 1737,
        "code": "U+1F1FF U+1F1E6",
        "browser": "🇿🇦",
        "shortname": "flag: South Africa"
      },
      {
        "number": 1738,
        "code": "U+1F1FF U+1F1F2",
        "browser": "🇿🇲",
        "shortname": "flag: Zambia"
      },
      {
        "number": 1739,
        "code": "U+1F1FF U+1F1FC",
        "browser": "🇿🇼",
        "shortname": "flag: Zimbabwe"
      },
      {
        "number": 1740,
        "code": "U+1F3F4 U+E0067 U+E0062 U+E0065 U+E006E U+E0067 U+E007F",
        "browser": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
        "shortname": "flag: England"
      },
      {
        "number": 1741,
        "code": "U+1F3F4 U+E0067 U+E0062 U+E0073 U+E0063 U+E0074 U+E007F",
        "browser": "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
        "shortname": "flag: Scotland"
      },
      {
        "number": 1742,
        "code": "U+1F3F4 U+E0067 U+E0062 U+E0077 U+E006C U+E0073 U+E007F",
        "browser": "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
        "shortname": "flag: Wales"
      }
    ];

    /* src/App.svelte generated by Svelte v3.17.0 */

    const { console: console_1 } = globals;
    const file = "src/App.svelte";

    function create_fragment(ctx) {
    	let main;
    	let h1;
    	let t0;
    	let t1;
    	let input;
    	let t2;
    	let div;
    	let p0;
    	let t3;
    	let t4;
    	let p1;
    	let div_class_value;
    	let dispose;

    	const block = {
    		c: function create() {
    			main = element("main");
    			h1 = element("h1");
    			t0 = text(/*title*/ ctx[0]);
    			t1 = space();
    			input = element("input");
    			t2 = space();
    			div = element("div");
    			p0 = element("p");
    			t3 = text(/*emoji*/ ctx[1]);
    			t4 = space();
    			p1 = element("p");
    			attr_dev(h1, "class", "svelte-4ubra2");
    			add_location(h1, file, 136, 2, 2759);
    			attr_dev(input, "placeholder", "Enter your name");
    			attr_dev(input, "class", "svelte-4ubra2");
    			add_location(input, file, 137, 2, 2778);
    			attr_dev(p0, "class", "emoji svelte-4ubra2");
    			add_location(p0, file, 139, 4, 2878);
    			attr_dev(p1, "class", "name svelte-4ubra2");
    			add_location(p1, file, 140, 4, 2911);
    			attr_dev(div, "class", div_class_value = "output " + /*visible*/ ctx[3] + " svelte-4ubra2");
    			add_location(div, file, 138, 2, 2843);
    			attr_dev(main, "class", "svelte-4ubra2");
    			add_location(main, file, 135, 0, 2750);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, h1);
    			append_dev(h1, t0);
    			append_dev(main, t1);
    			append_dev(main, input);
    			append_dev(main, t2);
    			append_dev(main, div);
    			append_dev(div, p0);
    			append_dev(p0, t3);
    			append_dev(div, t4);
    			append_dev(div, p1);
    			p1.innerHTML = /*name*/ ctx[2];
    			dispose = listen_dev(input, "input", /*handleInput*/ ctx[4], false, false, false);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*title*/ 1) set_data_dev(t0, /*title*/ ctx[0]);
    			if (dirty & /*emoji*/ 2) set_data_dev(t3, /*emoji*/ ctx[1]);
    			if (dirty & /*name*/ 4) p1.innerHTML = /*name*/ ctx[2];
    			if (dirty & /*visible*/ 8 && div_class_value !== (div_class_value = "output " + /*visible*/ ctx[3] + " svelte-4ubra2")) {
    				attr_dev(div, "class", div_class_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { title } = $$props;
    	let prev = null;
    	let emoji = null;
    	let name = null;
    	let visible = false;
    	let includeFlags = false;

    	function flagCheck(d) {
    		if (includeFlags) return true;
    		return !d.shortname.includes("flag:");
    	}

    	function getEmoji(i) {
    		if (!i.length) return null;
    		const chars = [...i];
    		const exp = chars.map(d => `.*${d}`).join("");
    		const reg = new RegExp(exp);
    		const filtered = emojiData.filter(d => flagCheck(d) && reg.test(d.shortname));
    		if (!filtered.length) return null;

    		const withLength = filtered.map(d => {
    			const { shortname } = d;
    			const [match] = shortname.match(reg);
    			const start = shortname.indexOf(chars[0]);
    			const end = match.length;
    			const sub = shortname.substring(start, end);
    			const len = sub.length;
    			return { ...d, len };
    		});

    		withLength.sort((a, b) => descending(a.len, b.len)) || descending(+a.number, +b.number);
    		const top = withLength.pop();
    		const start = { str: top.shortname, index: 0 };

    		top.marked = chars.reduce(
    			(prev, cur) => {
    				const pre = prev.str.substring(0, prev.index);
    				const after = prev.str.substring(prev.index, prev.str.length);
    				const end = after.indexOf(cur);
    				const inject = after.substring(0, end);
    				const post = after.substring(end + 1);
    				console.log({ pre, after, end, inject, post });
    				const str = `${pre}${inject}<mark>${cur}</mark>${post}`;
    				const index = str.length - post.length;
    				return { str, index };
    			},
    			start
    		).str;

    		return top;
    	}

    	function handleInput() {
    		const input = this.value.replace(/\W/g, "");
    		if (!input.length) prev = null;
    		const output = getEmoji(input) || prev;

    		if (output) {
    			$$invalidate(1, emoji = output.browser);
    			$$invalidate(2, name = output.marked);
    			prev = output;
    		}

    		$$invalidate(3, visible = !!output ? "is-visible" : "");
    	}

    	const writable_props = ["title"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$set = $$props => {
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    	};

    	$$self.$capture_state = () => {
    		return {
    			title,
    			prev,
    			emoji,
    			name,
    			visible,
    			includeFlags
    		};
    	};

    	$$self.$inject_state = $$props => {
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    		if ("prev" in $$props) prev = $$props.prev;
    		if ("emoji" in $$props) $$invalidate(1, emoji = $$props.emoji);
    		if ("name" in $$props) $$invalidate(2, name = $$props.name);
    		if ("visible" in $$props) $$invalidate(3, visible = $$props.visible);
    		if ("includeFlags" in $$props) includeFlags = $$props.includeFlags;
    	};

    	return [title, emoji, name, visible, handleInput];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { title: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || ({});

    		if (/*title*/ ctx[0] === undefined && !("title" in props)) {
    			console_1.warn("<App> was created without expected prop 'title'");
    		}
    	}

    	get title() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set title(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		title: 'What is your spirit emoji?'
    	}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
