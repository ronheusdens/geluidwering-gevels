var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// node_modules/polygon-clipping/dist/polygon-clipping.umd.js
var require_polygon_clipping_umd = __commonJS({
  "node_modules/polygon-clipping/dist/polygon-clipping.umd.js"(exports, module) {
    (function(global, factory) {
      typeof exports === "object" && typeof module !== "undefined" ? module.exports = factory() : typeof define === "function" && define.amd ? define(factory) : (global = typeof globalThis !== "undefined" ? globalThis : global || self, global.polygonClipping = factory());
    })(exports, (function() {
      "use strict";
      function __generator(thisArg, body) {
        var _ = {
          label: 0,
          sent: function() {
            if (t[0] & 1) throw t[1];
            return t[1];
          },
          trys: [],
          ops: []
        }, f, y, t, g;
        return g = {
          next: verb(0),
          "throw": verb(1),
          "return": verb(2)
        }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
          return this;
        }), g;
        function verb(n) {
          return function(v) {
            return step([n, v]);
          };
        }
        function step(op) {
          if (f) throw new TypeError("Generator is already executing.");
          while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
              case 0:
              case 1:
                t = op;
                break;
              case 4:
                _.label++;
                return {
                  value: op[1],
                  done: false
                };
              case 5:
                _.label++;
                y = op[1];
                op = [0];
                continue;
              case 7:
                op = _.ops.pop();
                _.trys.pop();
                continue;
              default:
                if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                  _ = 0;
                  continue;
                }
                if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                  _.label = op[1];
                  break;
                }
                if (op[0] === 6 && _.label < t[1]) {
                  _.label = t[1];
                  t = op;
                  break;
                }
                if (t && _.label < t[2]) {
                  _.label = t[2];
                  _.ops.push(op);
                  break;
                }
                if (t[2]) _.ops.pop();
                _.trys.pop();
                continue;
            }
            op = body.call(thisArg, _);
          } catch (e) {
            op = [6, e];
            y = 0;
          } finally {
            f = t = 0;
          }
          if (op[0] & 5) throw op[1];
          return {
            value: op[0] ? op[1] : void 0,
            done: true
          };
        }
      }
      var Node = (
        /** @class */
        /* @__PURE__ */ (function() {
          function Node2(key, data) {
            this.next = null;
            this.key = key;
            this.data = data;
            this.left = null;
            this.right = null;
          }
          return Node2;
        })()
      );
      function DEFAULT_COMPARE(a, b) {
        return a > b ? 1 : a < b ? -1 : 0;
      }
      function splay(i, t, comparator) {
        var N = new Node(null, null);
        var l = N;
        var r = N;
        while (true) {
          var cmp2 = comparator(i, t.key);
          if (cmp2 < 0) {
            if (t.left === null) break;
            if (comparator(i, t.left.key) < 0) {
              var y = t.left;
              t.left = y.right;
              y.right = t;
              t = y;
              if (t.left === null) break;
            }
            r.left = t;
            r = t;
            t = t.left;
          } else if (cmp2 > 0) {
            if (t.right === null) break;
            if (comparator(i, t.right.key) > 0) {
              var y = t.right;
              t.right = y.left;
              y.left = t;
              t = y;
              if (t.right === null) break;
            }
            l.right = t;
            l = t;
            t = t.right;
          } else break;
        }
        l.right = t.left;
        r.left = t.right;
        t.left = N.right;
        t.right = N.left;
        return t;
      }
      function insert(i, data, t, comparator) {
        var node = new Node(i, data);
        if (t === null) {
          node.left = node.right = null;
          return node;
        }
        t = splay(i, t, comparator);
        var cmp2 = comparator(i, t.key);
        if (cmp2 < 0) {
          node.left = t.left;
          node.right = t;
          t.left = null;
        } else if (cmp2 >= 0) {
          node.right = t.right;
          node.left = t;
          t.right = null;
        }
        return node;
      }
      function split(key, v, comparator) {
        var left = null;
        var right = null;
        if (v) {
          v = splay(key, v, comparator);
          var cmp2 = comparator(v.key, key);
          if (cmp2 === 0) {
            left = v.left;
            right = v.right;
          } else if (cmp2 < 0) {
            right = v.right;
            v.right = null;
            left = v;
          } else {
            left = v.left;
            v.left = null;
            right = v;
          }
        }
        return {
          left,
          right
        };
      }
      function merge(left, right, comparator) {
        if (right === null) return left;
        if (left === null) return right;
        right = splay(left.key, right, comparator);
        right.left = left;
        return right;
      }
      function printRow(root, prefix, isTail, out, printNode) {
        if (root) {
          out("" + prefix + (isTail ? "\u2514\u2500\u2500 " : "\u251C\u2500\u2500 ") + printNode(root) + "\n");
          var indent = prefix + (isTail ? "    " : "\u2502   ");
          if (root.left) printRow(root.left, indent, false, out, printNode);
          if (root.right) printRow(root.right, indent, true, out, printNode);
        }
      }
      var Tree = (
        /** @class */
        (function() {
          function Tree2(comparator) {
            if (comparator === void 0) {
              comparator = DEFAULT_COMPARE;
            }
            this._root = null;
            this._size = 0;
            this._comparator = comparator;
          }
          Tree2.prototype.insert = function(key, data) {
            this._size++;
            return this._root = insert(key, data, this._root, this._comparator);
          };
          Tree2.prototype.add = function(key, data) {
            var node = new Node(key, data);
            if (this._root === null) {
              node.left = node.right = null;
              this._size++;
              this._root = node;
            }
            var comparator = this._comparator;
            var t = splay(key, this._root, comparator);
            var cmp2 = comparator(key, t.key);
            if (cmp2 === 0) this._root = t;
            else {
              if (cmp2 < 0) {
                node.left = t.left;
                node.right = t;
                t.left = null;
              } else if (cmp2 > 0) {
                node.right = t.right;
                node.left = t;
                t.right = null;
              }
              this._size++;
              this._root = node;
            }
            return this._root;
          };
          Tree2.prototype.remove = function(key) {
            this._root = this._remove(key, this._root, this._comparator);
          };
          Tree2.prototype._remove = function(i, t, comparator) {
            var x;
            if (t === null) return null;
            t = splay(i, t, comparator);
            var cmp2 = comparator(i, t.key);
            if (cmp2 === 0) {
              if (t.left === null) {
                x = t.right;
              } else {
                x = splay(i, t.left, comparator);
                x.right = t.right;
              }
              this._size--;
              return x;
            }
            return t;
          };
          Tree2.prototype.pop = function() {
            var node = this._root;
            if (node) {
              while (node.left) node = node.left;
              this._root = splay(node.key, this._root, this._comparator);
              this._root = this._remove(node.key, this._root, this._comparator);
              return {
                key: node.key,
                data: node.data
              };
            }
            return null;
          };
          Tree2.prototype.findStatic = function(key) {
            var current = this._root;
            var compare = this._comparator;
            while (current) {
              var cmp2 = compare(key, current.key);
              if (cmp2 === 0) return current;
              else if (cmp2 < 0) current = current.left;
              else current = current.right;
            }
            return null;
          };
          Tree2.prototype.find = function(key) {
            if (this._root) {
              this._root = splay(key, this._root, this._comparator);
              if (this._comparator(key, this._root.key) !== 0) return null;
            }
            return this._root;
          };
          Tree2.prototype.contains = function(key) {
            var current = this._root;
            var compare = this._comparator;
            while (current) {
              var cmp2 = compare(key, current.key);
              if (cmp2 === 0) return true;
              else if (cmp2 < 0) current = current.left;
              else current = current.right;
            }
            return false;
          };
          Tree2.prototype.forEach = function(visitor, ctx) {
            var current = this._root;
            var Q = [];
            var done = false;
            while (!done) {
              if (current !== null) {
                Q.push(current);
                current = current.left;
              } else {
                if (Q.length !== 0) {
                  current = Q.pop();
                  visitor.call(ctx, current);
                  current = current.right;
                } else done = true;
              }
            }
            return this;
          };
          Tree2.prototype.range = function(low, high, fn, ctx) {
            var Q = [];
            var compare = this._comparator;
            var node = this._root;
            var cmp2;
            while (Q.length !== 0 || node) {
              if (node) {
                Q.push(node);
                node = node.left;
              } else {
                node = Q.pop();
                cmp2 = compare(node.key, high);
                if (cmp2 > 0) {
                  break;
                } else if (compare(node.key, low) >= 0) {
                  if (fn.call(ctx, node)) return this;
                }
                node = node.right;
              }
            }
            return this;
          };
          Tree2.prototype.keys = function() {
            var keys = [];
            this.forEach(function(_a) {
              var key = _a.key;
              return keys.push(key);
            });
            return keys;
          };
          Tree2.prototype.values = function() {
            var values = [];
            this.forEach(function(_a) {
              var data = _a.data;
              return values.push(data);
            });
            return values;
          };
          Tree2.prototype.min = function() {
            if (this._root) return this.minNode(this._root).key;
            return null;
          };
          Tree2.prototype.max = function() {
            if (this._root) return this.maxNode(this._root).key;
            return null;
          };
          Tree2.prototype.minNode = function(t) {
            if (t === void 0) {
              t = this._root;
            }
            if (t) while (t.left) t = t.left;
            return t;
          };
          Tree2.prototype.maxNode = function(t) {
            if (t === void 0) {
              t = this._root;
            }
            if (t) while (t.right) t = t.right;
            return t;
          };
          Tree2.prototype.at = function(index2) {
            var current = this._root;
            var done = false;
            var i = 0;
            var Q = [];
            while (!done) {
              if (current) {
                Q.push(current);
                current = current.left;
              } else {
                if (Q.length > 0) {
                  current = Q.pop();
                  if (i === index2) return current;
                  i++;
                  current = current.right;
                } else done = true;
              }
            }
            return null;
          };
          Tree2.prototype.next = function(d) {
            var root = this._root;
            var successor = null;
            if (d.right) {
              successor = d.right;
              while (successor.left) successor = successor.left;
              return successor;
            }
            var comparator = this._comparator;
            while (root) {
              var cmp2 = comparator(d.key, root.key);
              if (cmp2 === 0) break;
              else if (cmp2 < 0) {
                successor = root;
                root = root.left;
              } else root = root.right;
            }
            return successor;
          };
          Tree2.prototype.prev = function(d) {
            var root = this._root;
            var predecessor = null;
            if (d.left !== null) {
              predecessor = d.left;
              while (predecessor.right) predecessor = predecessor.right;
              return predecessor;
            }
            var comparator = this._comparator;
            while (root) {
              var cmp2 = comparator(d.key, root.key);
              if (cmp2 === 0) break;
              else if (cmp2 < 0) root = root.left;
              else {
                predecessor = root;
                root = root.right;
              }
            }
            return predecessor;
          };
          Tree2.prototype.clear = function() {
            this._root = null;
            this._size = 0;
            return this;
          };
          Tree2.prototype.toList = function() {
            return toList(this._root);
          };
          Tree2.prototype.load = function(keys, values, presort) {
            if (values === void 0) {
              values = [];
            }
            if (presort === void 0) {
              presort = false;
            }
            var size = keys.length;
            var comparator = this._comparator;
            if (presort) sort(keys, values, 0, size - 1, comparator);
            if (this._root === null) {
              this._root = loadRecursive(keys, values, 0, size);
              this._size = size;
            } else {
              var mergedList = mergeLists(this.toList(), createList(keys, values), comparator);
              size = this._size + size;
              this._root = sortedListToBST({
                head: mergedList
              }, 0, size);
            }
            return this;
          };
          Tree2.prototype.isEmpty = function() {
            return this._root === null;
          };
          Object.defineProperty(Tree2.prototype, "size", {
            get: function() {
              return this._size;
            },
            enumerable: true,
            configurable: true
          });
          Object.defineProperty(Tree2.prototype, "root", {
            get: function() {
              return this._root;
            },
            enumerable: true,
            configurable: true
          });
          Tree2.prototype.toString = function(printNode) {
            if (printNode === void 0) {
              printNode = function(n) {
                return String(n.key);
              };
            }
            var out = [];
            printRow(this._root, "", true, function(v) {
              return out.push(v);
            }, printNode);
            return out.join("");
          };
          Tree2.prototype.update = function(key, newKey, newData) {
            var comparator = this._comparator;
            var _a = split(key, this._root, comparator), left = _a.left, right = _a.right;
            if (comparator(key, newKey) < 0) {
              right = insert(newKey, newData, right, comparator);
            } else {
              left = insert(newKey, newData, left, comparator);
            }
            this._root = merge(left, right, comparator);
          };
          Tree2.prototype.split = function(key) {
            return split(key, this._root, this._comparator);
          };
          Tree2.prototype[Symbol.iterator] = function() {
            var current, Q, done;
            return __generator(this, function(_a) {
              switch (_a.label) {
                case 0:
                  current = this._root;
                  Q = [];
                  done = false;
                  _a.label = 1;
                case 1:
                  if (!!done) return [3, 6];
                  if (!(current !== null)) return [3, 2];
                  Q.push(current);
                  current = current.left;
                  return [3, 5];
                case 2:
                  if (!(Q.length !== 0)) return [3, 4];
                  current = Q.pop();
                  return [4, current];
                case 3:
                  _a.sent();
                  current = current.right;
                  return [3, 5];
                case 4:
                  done = true;
                  _a.label = 5;
                case 5:
                  return [3, 1];
                case 6:
                  return [
                    2
                    /*return*/
                  ];
              }
            });
          };
          return Tree2;
        })()
      );
      function loadRecursive(keys, values, start, end) {
        var size = end - start;
        if (size > 0) {
          var middle = start + Math.floor(size / 2);
          var key = keys[middle];
          var data = values[middle];
          var node = new Node(key, data);
          node.left = loadRecursive(keys, values, start, middle);
          node.right = loadRecursive(keys, values, middle + 1, end);
          return node;
        }
        return null;
      }
      function createList(keys, values) {
        var head = new Node(null, null);
        var p = head;
        for (var i = 0; i < keys.length; i++) {
          p = p.next = new Node(keys[i], values[i]);
        }
        p.next = null;
        return head.next;
      }
      function toList(root) {
        var current = root;
        var Q = [];
        var done = false;
        var head = new Node(null, null);
        var p = head;
        while (!done) {
          if (current) {
            Q.push(current);
            current = current.left;
          } else {
            if (Q.length > 0) {
              current = p = p.next = Q.pop();
              current = current.right;
            } else done = true;
          }
        }
        p.next = null;
        return head.next;
      }
      function sortedListToBST(list, start, end) {
        var size = end - start;
        if (size > 0) {
          var middle = start + Math.floor(size / 2);
          var left = sortedListToBST(list, start, middle);
          var root = list.head;
          root.left = left;
          list.head = list.head.next;
          root.right = sortedListToBST(list, middle + 1, end);
          return root;
        }
        return null;
      }
      function mergeLists(l1, l2, compare) {
        var head = new Node(null, null);
        var p = head;
        var p1 = l1;
        var p2 = l2;
        while (p1 !== null && p2 !== null) {
          if (compare(p1.key, p2.key) < 0) {
            p.next = p1;
            p1 = p1.next;
          } else {
            p.next = p2;
            p2 = p2.next;
          }
          p = p.next;
        }
        if (p1 !== null) {
          p.next = p1;
        } else if (p2 !== null) {
          p.next = p2;
        }
        return head.next;
      }
      function sort(keys, values, left, right, compare) {
        if (left >= right) return;
        var pivot = keys[left + right >> 1];
        var i = left - 1;
        var j = right + 1;
        while (true) {
          do
            i++;
          while (compare(keys[i], pivot) < 0);
          do
            j--;
          while (compare(keys[j], pivot) > 0);
          if (i >= j) break;
          var tmp = keys[i];
          keys[i] = keys[j];
          keys[j] = tmp;
          tmp = values[i];
          values[i] = values[j];
          values[j] = tmp;
        }
        sort(keys, values, left, j, compare);
        sort(keys, values, j + 1, right, compare);
      }
      const isInBbox = (bbox, point) => {
        return bbox.ll.x <= point.x && point.x <= bbox.ur.x && bbox.ll.y <= point.y && point.y <= bbox.ur.y;
      };
      const getBboxOverlap = (b1, b2) => {
        if (b2.ur.x < b1.ll.x || b1.ur.x < b2.ll.x || b2.ur.y < b1.ll.y || b1.ur.y < b2.ll.y) return null;
        const lowerX = b1.ll.x < b2.ll.x ? b2.ll.x : b1.ll.x;
        const upperX = b1.ur.x < b2.ur.x ? b1.ur.x : b2.ur.x;
        const lowerY = b1.ll.y < b2.ll.y ? b2.ll.y : b1.ll.y;
        const upperY = b1.ur.y < b2.ur.y ? b1.ur.y : b2.ur.y;
        return {
          ll: {
            x: lowerX,
            y: lowerY
          },
          ur: {
            x: upperX,
            y: upperY
          }
        };
      };
      let epsilon$1 = Number.EPSILON;
      if (epsilon$1 === void 0) epsilon$1 = Math.pow(2, -52);
      const EPSILON_SQ = epsilon$1 * epsilon$1;
      const cmp = (a, b) => {
        if (-epsilon$1 < a && a < epsilon$1) {
          if (-epsilon$1 < b && b < epsilon$1) {
            return 0;
          }
        }
        const ab = a - b;
        if (ab * ab < EPSILON_SQ * a * b) {
          return 0;
        }
        return a < b ? -1 : 1;
      };
      class PtRounder {
        constructor() {
          this.reset();
        }
        reset() {
          this.xRounder = new CoordRounder();
          this.yRounder = new CoordRounder();
        }
        round(x, y) {
          return {
            x: this.xRounder.round(x),
            y: this.yRounder.round(y)
          };
        }
      }
      class CoordRounder {
        constructor() {
          this.tree = new Tree();
          this.round(0);
        }
        // Note: this can rounds input values backwards or forwards.
        //       You might ask, why not restrict this to just rounding
        //       forwards? Wouldn't that allow left endpoints to always
        //       remain left endpoints during splitting (never change to
        //       right). No - it wouldn't, because we snap intersections
        //       to endpoints (to establish independence from the segment
        //       angle for t-intersections).
        round(coord) {
          const node = this.tree.add(coord);
          const prevNode = this.tree.prev(node);
          if (prevNode !== null && cmp(node.key, prevNode.key) === 0) {
            this.tree.remove(coord);
            return prevNode.key;
          }
          const nextNode = this.tree.next(node);
          if (nextNode !== null && cmp(node.key, nextNode.key) === 0) {
            this.tree.remove(coord);
            return nextNode.key;
          }
          return coord;
        }
      }
      const rounder = new PtRounder();
      const epsilon = 11102230246251565e-32;
      const splitter = 134217729;
      const resulterrbound = (3 + 8 * epsilon) * epsilon;
      function sum(elen, e, flen, f, h) {
        let Q, Qnew, hh, bvirt;
        let enow = e[0];
        let fnow = f[0];
        let eindex = 0;
        let findex = 0;
        if (fnow > enow === fnow > -enow) {
          Q = enow;
          enow = e[++eindex];
        } else {
          Q = fnow;
          fnow = f[++findex];
        }
        let hindex = 0;
        if (eindex < elen && findex < flen) {
          if (fnow > enow === fnow > -enow) {
            Qnew = enow + Q;
            hh = Q - (Qnew - enow);
            enow = e[++eindex];
          } else {
            Qnew = fnow + Q;
            hh = Q - (Qnew - fnow);
            fnow = f[++findex];
          }
          Q = Qnew;
          if (hh !== 0) {
            h[hindex++] = hh;
          }
          while (eindex < elen && findex < flen) {
            if (fnow > enow === fnow > -enow) {
              Qnew = Q + enow;
              bvirt = Qnew - Q;
              hh = Q - (Qnew - bvirt) + (enow - bvirt);
              enow = e[++eindex];
            } else {
              Qnew = Q + fnow;
              bvirt = Qnew - Q;
              hh = Q - (Qnew - bvirt) + (fnow - bvirt);
              fnow = f[++findex];
            }
            Q = Qnew;
            if (hh !== 0) {
              h[hindex++] = hh;
            }
          }
        }
        while (eindex < elen) {
          Qnew = Q + enow;
          bvirt = Qnew - Q;
          hh = Q - (Qnew - bvirt) + (enow - bvirt);
          enow = e[++eindex];
          Q = Qnew;
          if (hh !== 0) {
            h[hindex++] = hh;
          }
        }
        while (findex < flen) {
          Qnew = Q + fnow;
          bvirt = Qnew - Q;
          hh = Q - (Qnew - bvirt) + (fnow - bvirt);
          fnow = f[++findex];
          Q = Qnew;
          if (hh !== 0) {
            h[hindex++] = hh;
          }
        }
        if (Q !== 0 || hindex === 0) {
          h[hindex++] = Q;
        }
        return hindex;
      }
      function estimate(elen, e) {
        let Q = e[0];
        for (let i = 1; i < elen; i++) Q += e[i];
        return Q;
      }
      function vec(n) {
        return new Float64Array(n);
      }
      const ccwerrboundA = (3 + 16 * epsilon) * epsilon;
      const ccwerrboundB = (2 + 12 * epsilon) * epsilon;
      const ccwerrboundC = (9 + 64 * epsilon) * epsilon * epsilon;
      const B = vec(4);
      const C1 = vec(8);
      const C2 = vec(12);
      const D = vec(16);
      const u = vec(4);
      function orient2dadapt(ax, ay, bx, by, cx, cy, detsum) {
        let acxtail, acytail, bcxtail, bcytail;
        let bvirt, c, ahi, alo, bhi, blo, _i, _j, _0, s1, s0, t1, t0, u3;
        const acx = ax - cx;
        const bcx = bx - cx;
        const acy = ay - cy;
        const bcy = by - cy;
        s1 = acx * bcy;
        c = splitter * acx;
        ahi = c - (c - acx);
        alo = acx - ahi;
        c = splitter * bcy;
        bhi = c - (c - bcy);
        blo = bcy - bhi;
        s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
        t1 = acy * bcx;
        c = splitter * acy;
        ahi = c - (c - acy);
        alo = acy - ahi;
        c = splitter * bcx;
        bhi = c - (c - bcx);
        blo = bcx - bhi;
        t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
        _i = s0 - t0;
        bvirt = s0 - _i;
        B[0] = s0 - (_i + bvirt) + (bvirt - t0);
        _j = s1 + _i;
        bvirt = _j - s1;
        _0 = s1 - (_j - bvirt) + (_i - bvirt);
        _i = _0 - t1;
        bvirt = _0 - _i;
        B[1] = _0 - (_i + bvirt) + (bvirt - t1);
        u3 = _j + _i;
        bvirt = u3 - _j;
        B[2] = _j - (u3 - bvirt) + (_i - bvirt);
        B[3] = u3;
        let det = estimate(4, B);
        let errbound = ccwerrboundB * detsum;
        if (det >= errbound || -det >= errbound) {
          return det;
        }
        bvirt = ax - acx;
        acxtail = ax - (acx + bvirt) + (bvirt - cx);
        bvirt = bx - bcx;
        bcxtail = bx - (bcx + bvirt) + (bvirt - cx);
        bvirt = ay - acy;
        acytail = ay - (acy + bvirt) + (bvirt - cy);
        bvirt = by - bcy;
        bcytail = by - (bcy + bvirt) + (bvirt - cy);
        if (acxtail === 0 && acytail === 0 && bcxtail === 0 && bcytail === 0) {
          return det;
        }
        errbound = ccwerrboundC * detsum + resulterrbound * Math.abs(det);
        det += acx * bcytail + bcy * acxtail - (acy * bcxtail + bcx * acytail);
        if (det >= errbound || -det >= errbound) return det;
        s1 = acxtail * bcy;
        c = splitter * acxtail;
        ahi = c - (c - acxtail);
        alo = acxtail - ahi;
        c = splitter * bcy;
        bhi = c - (c - bcy);
        blo = bcy - bhi;
        s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
        t1 = acytail * bcx;
        c = splitter * acytail;
        ahi = c - (c - acytail);
        alo = acytail - ahi;
        c = splitter * bcx;
        bhi = c - (c - bcx);
        blo = bcx - bhi;
        t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
        _i = s0 - t0;
        bvirt = s0 - _i;
        u[0] = s0 - (_i + bvirt) + (bvirt - t0);
        _j = s1 + _i;
        bvirt = _j - s1;
        _0 = s1 - (_j - bvirt) + (_i - bvirt);
        _i = _0 - t1;
        bvirt = _0 - _i;
        u[1] = _0 - (_i + bvirt) + (bvirt - t1);
        u3 = _j + _i;
        bvirt = u3 - _j;
        u[2] = _j - (u3 - bvirt) + (_i - bvirt);
        u[3] = u3;
        const C1len = sum(4, B, 4, u, C1);
        s1 = acx * bcytail;
        c = splitter * acx;
        ahi = c - (c - acx);
        alo = acx - ahi;
        c = splitter * bcytail;
        bhi = c - (c - bcytail);
        blo = bcytail - bhi;
        s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
        t1 = acy * bcxtail;
        c = splitter * acy;
        ahi = c - (c - acy);
        alo = acy - ahi;
        c = splitter * bcxtail;
        bhi = c - (c - bcxtail);
        blo = bcxtail - bhi;
        t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
        _i = s0 - t0;
        bvirt = s0 - _i;
        u[0] = s0 - (_i + bvirt) + (bvirt - t0);
        _j = s1 + _i;
        bvirt = _j - s1;
        _0 = s1 - (_j - bvirt) + (_i - bvirt);
        _i = _0 - t1;
        bvirt = _0 - _i;
        u[1] = _0 - (_i + bvirt) + (bvirt - t1);
        u3 = _j + _i;
        bvirt = u3 - _j;
        u[2] = _j - (u3 - bvirt) + (_i - bvirt);
        u[3] = u3;
        const C2len = sum(C1len, C1, 4, u, C2);
        s1 = acxtail * bcytail;
        c = splitter * acxtail;
        ahi = c - (c - acxtail);
        alo = acxtail - ahi;
        c = splitter * bcytail;
        bhi = c - (c - bcytail);
        blo = bcytail - bhi;
        s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
        t1 = acytail * bcxtail;
        c = splitter * acytail;
        ahi = c - (c - acytail);
        alo = acytail - ahi;
        c = splitter * bcxtail;
        bhi = c - (c - bcxtail);
        blo = bcxtail - bhi;
        t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
        _i = s0 - t0;
        bvirt = s0 - _i;
        u[0] = s0 - (_i + bvirt) + (bvirt - t0);
        _j = s1 + _i;
        bvirt = _j - s1;
        _0 = s1 - (_j - bvirt) + (_i - bvirt);
        _i = _0 - t1;
        bvirt = _0 - _i;
        u[1] = _0 - (_i + bvirt) + (bvirt - t1);
        u3 = _j + _i;
        bvirt = u3 - _j;
        u[2] = _j - (u3 - bvirt) + (_i - bvirt);
        u[3] = u3;
        const Dlen = sum(C2len, C2, 4, u, D);
        return D[Dlen - 1];
      }
      function orient2d(ax, ay, bx, by, cx, cy) {
        const detleft = (ay - cy) * (bx - cx);
        const detright = (ax - cx) * (by - cy);
        const det = detleft - detright;
        const detsum = Math.abs(detleft + detright);
        if (Math.abs(det) >= ccwerrboundA * detsum) return det;
        return -orient2dadapt(ax, ay, bx, by, cx, cy, detsum);
      }
      const crossProduct = (a, b) => a.x * b.y - a.y * b.x;
      const dotProduct = (a, b) => a.x * b.x + a.y * b.y;
      const compareVectorAngles = (basePt, endPt1, endPt2) => {
        const res = orient2d(basePt.x, basePt.y, endPt1.x, endPt1.y, endPt2.x, endPt2.y);
        if (res > 0) return -1;
        if (res < 0) return 1;
        return 0;
      };
      const length = (v) => Math.sqrt(dotProduct(v, v));
      const sineOfAngle = (pShared, pBase, pAngle) => {
        const vBase = {
          x: pBase.x - pShared.x,
          y: pBase.y - pShared.y
        };
        const vAngle = {
          x: pAngle.x - pShared.x,
          y: pAngle.y - pShared.y
        };
        return crossProduct(vAngle, vBase) / length(vAngle) / length(vBase);
      };
      const cosineOfAngle = (pShared, pBase, pAngle) => {
        const vBase = {
          x: pBase.x - pShared.x,
          y: pBase.y - pShared.y
        };
        const vAngle = {
          x: pAngle.x - pShared.x,
          y: pAngle.y - pShared.y
        };
        return dotProduct(vAngle, vBase) / length(vAngle) / length(vBase);
      };
      const horizontalIntersection = (pt, v, y) => {
        if (v.y === 0) return null;
        return {
          x: pt.x + v.x / v.y * (y - pt.y),
          y
        };
      };
      const verticalIntersection = (pt, v, x) => {
        if (v.x === 0) return null;
        return {
          x,
          y: pt.y + v.y / v.x * (x - pt.x)
        };
      };
      const intersection$1 = (pt1, v1, pt2, v2) => {
        if (v1.x === 0) return verticalIntersection(pt2, v2, pt1.x);
        if (v2.x === 0) return verticalIntersection(pt1, v1, pt2.x);
        if (v1.y === 0) return horizontalIntersection(pt2, v2, pt1.y);
        if (v2.y === 0) return horizontalIntersection(pt1, v1, pt2.y);
        const kross = crossProduct(v1, v2);
        if (kross == 0) return null;
        const ve = {
          x: pt2.x - pt1.x,
          y: pt2.y - pt1.y
        };
        const d1 = crossProduct(ve, v1) / kross;
        const d2 = crossProduct(ve, v2) / kross;
        const x1 = pt1.x + d2 * v1.x, x2 = pt2.x + d1 * v2.x;
        const y1 = pt1.y + d2 * v1.y, y2 = pt2.y + d1 * v2.y;
        const x = (x1 + x2) / 2;
        const y = (y1 + y2) / 2;
        return {
          x,
          y
        };
      };
      class SweepEvent {
        // for ordering sweep events in the sweep event queue
        static compare(a, b) {
          const ptCmp = SweepEvent.comparePoints(a.point, b.point);
          if (ptCmp !== 0) return ptCmp;
          if (a.point !== b.point) a.link(b);
          if (a.isLeft !== b.isLeft) return a.isLeft ? 1 : -1;
          return Segment.compare(a.segment, b.segment);
        }
        // for ordering points in sweep line order
        static comparePoints(aPt, bPt) {
          if (aPt.x < bPt.x) return -1;
          if (aPt.x > bPt.x) return 1;
          if (aPt.y < bPt.y) return -1;
          if (aPt.y > bPt.y) return 1;
          return 0;
        }
        // Warning: 'point' input will be modified and re-used (for performance)
        constructor(point, isLeft) {
          if (point.events === void 0) point.events = [this];
          else point.events.push(this);
          this.point = point;
          this.isLeft = isLeft;
        }
        link(other) {
          if (other.point === this.point) {
            throw new Error("Tried to link already linked events");
          }
          const otherEvents = other.point.events;
          for (let i = 0, iMax = otherEvents.length; i < iMax; i++) {
            const evt = otherEvents[i];
            this.point.events.push(evt);
            evt.point = this.point;
          }
          this.checkForConsuming();
        }
        /* Do a pass over our linked events and check to see if any pair
         * of segments match, and should be consumed. */
        checkForConsuming() {
          const numEvents = this.point.events.length;
          for (let i = 0; i < numEvents; i++) {
            const evt1 = this.point.events[i];
            if (evt1.segment.consumedBy !== void 0) continue;
            for (let j = i + 1; j < numEvents; j++) {
              const evt2 = this.point.events[j];
              if (evt2.consumedBy !== void 0) continue;
              if (evt1.otherSE.point.events !== evt2.otherSE.point.events) continue;
              evt1.segment.consume(evt2.segment);
            }
          }
        }
        getAvailableLinkedEvents() {
          const events = [];
          for (let i = 0, iMax = this.point.events.length; i < iMax; i++) {
            const evt = this.point.events[i];
            if (evt !== this && !evt.segment.ringOut && evt.segment.isInResult()) {
              events.push(evt);
            }
          }
          return events;
        }
        /**
         * Returns a comparator function for sorting linked events that will
         * favor the event that will give us the smallest left-side angle.
         * All ring construction starts as low as possible heading to the right,
         * so by always turning left as sharp as possible we'll get polygons
         * without uncessary loops & holes.
         *
         * The comparator function has a compute cache such that it avoids
         * re-computing already-computed values.
         */
        getLeftmostComparator(baseEvent) {
          const cache = /* @__PURE__ */ new Map();
          const fillCache = (linkedEvent) => {
            const nextEvent = linkedEvent.otherSE;
            cache.set(linkedEvent, {
              sine: sineOfAngle(this.point, baseEvent.point, nextEvent.point),
              cosine: cosineOfAngle(this.point, baseEvent.point, nextEvent.point)
            });
          };
          return (a, b) => {
            if (!cache.has(a)) fillCache(a);
            if (!cache.has(b)) fillCache(b);
            const {
              sine: asine,
              cosine: acosine
            } = cache.get(a);
            const {
              sine: bsine,
              cosine: bcosine
            } = cache.get(b);
            if (asine >= 0 && bsine >= 0) {
              if (acosine < bcosine) return 1;
              if (acosine > bcosine) return -1;
              return 0;
            }
            if (asine < 0 && bsine < 0) {
              if (acosine < bcosine) return -1;
              if (acosine > bcosine) return 1;
              return 0;
            }
            if (bsine < asine) return -1;
            if (bsine > asine) return 1;
            return 0;
          };
        }
      }
      let segmentId = 0;
      class Segment {
        /* This compare() function is for ordering segments in the sweep
         * line tree, and does so according to the following criteria:
         *
         * Consider the vertical line that lies an infinestimal step to the
         * right of the right-more of the two left endpoints of the input
         * segments. Imagine slowly moving a point up from negative infinity
         * in the increasing y direction. Which of the two segments will that
         * point intersect first? That segment comes 'before' the other one.
         *
         * If neither segment would be intersected by such a line, (if one
         * or more of the segments are vertical) then the line to be considered
         * is directly on the right-more of the two left inputs.
         */
        static compare(a, b) {
          const alx = a.leftSE.point.x;
          const blx = b.leftSE.point.x;
          const arx = a.rightSE.point.x;
          const brx = b.rightSE.point.x;
          if (brx < alx) return 1;
          if (arx < blx) return -1;
          const aly = a.leftSE.point.y;
          const bly = b.leftSE.point.y;
          const ary = a.rightSE.point.y;
          const bry = b.rightSE.point.y;
          if (alx < blx) {
            if (bly < aly && bly < ary) return 1;
            if (bly > aly && bly > ary) return -1;
            const aCmpBLeft = a.comparePoint(b.leftSE.point);
            if (aCmpBLeft < 0) return 1;
            if (aCmpBLeft > 0) return -1;
            const bCmpARight = b.comparePoint(a.rightSE.point);
            if (bCmpARight !== 0) return bCmpARight;
            return -1;
          }
          if (alx > blx) {
            if (aly < bly && aly < bry) return -1;
            if (aly > bly && aly > bry) return 1;
            const bCmpALeft = b.comparePoint(a.leftSE.point);
            if (bCmpALeft !== 0) return bCmpALeft;
            const aCmpBRight = a.comparePoint(b.rightSE.point);
            if (aCmpBRight < 0) return 1;
            if (aCmpBRight > 0) return -1;
            return 1;
          }
          if (aly < bly) return -1;
          if (aly > bly) return 1;
          if (arx < brx) {
            const bCmpARight = b.comparePoint(a.rightSE.point);
            if (bCmpARight !== 0) return bCmpARight;
          }
          if (arx > brx) {
            const aCmpBRight = a.comparePoint(b.rightSE.point);
            if (aCmpBRight < 0) return 1;
            if (aCmpBRight > 0) return -1;
          }
          if (arx !== brx) {
            const ay = ary - aly;
            const ax = arx - alx;
            const by = bry - bly;
            const bx = brx - blx;
            if (ay > ax && by < bx) return 1;
            if (ay < ax && by > bx) return -1;
          }
          if (arx > brx) return 1;
          if (arx < brx) return -1;
          if (ary < bry) return -1;
          if (ary > bry) return 1;
          if (a.id < b.id) return -1;
          if (a.id > b.id) return 1;
          return 0;
        }
        /* Warning: a reference to ringWindings input will be stored,
         *  and possibly will be later modified */
        constructor(leftSE, rightSE, rings, windings) {
          this.id = ++segmentId;
          this.leftSE = leftSE;
          leftSE.segment = this;
          leftSE.otherSE = rightSE;
          this.rightSE = rightSE;
          rightSE.segment = this;
          rightSE.otherSE = leftSE;
          this.rings = rings;
          this.windings = windings;
        }
        static fromRing(pt1, pt2, ring) {
          let leftPt, rightPt, winding;
          const cmpPts = SweepEvent.comparePoints(pt1, pt2);
          if (cmpPts < 0) {
            leftPt = pt1;
            rightPt = pt2;
            winding = 1;
          } else if (cmpPts > 0) {
            leftPt = pt2;
            rightPt = pt1;
            winding = -1;
          } else throw new Error(`Tried to create degenerate segment at [${pt1.x}, ${pt1.y}]`);
          const leftSE = new SweepEvent(leftPt, true);
          const rightSE = new SweepEvent(rightPt, false);
          return new Segment(leftSE, rightSE, [ring], [winding]);
        }
        /* When a segment is split, the rightSE is replaced with a new sweep event */
        replaceRightSE(newRightSE) {
          this.rightSE = newRightSE;
          this.rightSE.segment = this;
          this.rightSE.otherSE = this.leftSE;
          this.leftSE.otherSE = this.rightSE;
        }
        bbox() {
          const y1 = this.leftSE.point.y;
          const y2 = this.rightSE.point.y;
          return {
            ll: {
              x: this.leftSE.point.x,
              y: y1 < y2 ? y1 : y2
            },
            ur: {
              x: this.rightSE.point.x,
              y: y1 > y2 ? y1 : y2
            }
          };
        }
        /* A vector from the left point to the right */
        vector() {
          return {
            x: this.rightSE.point.x - this.leftSE.point.x,
            y: this.rightSE.point.y - this.leftSE.point.y
          };
        }
        isAnEndpoint(pt) {
          return pt.x === this.leftSE.point.x && pt.y === this.leftSE.point.y || pt.x === this.rightSE.point.x && pt.y === this.rightSE.point.y;
        }
        /* Compare this segment with a point.
         *
         * A point P is considered to be colinear to a segment if there
         * exists a distance D such that if we travel along the segment
         * from one * endpoint towards the other a distance D, we find
         * ourselves at point P.
         *
         * Return value indicates:
         *
         *   1: point lies above the segment (to the left of vertical)
         *   0: point is colinear to segment
         *  -1: point lies below the segment (to the right of vertical)
         */
        comparePoint(point) {
          if (this.isAnEndpoint(point)) return 0;
          const lPt = this.leftSE.point;
          const rPt = this.rightSE.point;
          const v = this.vector();
          if (lPt.x === rPt.x) {
            if (point.x === lPt.x) return 0;
            return point.x < lPt.x ? 1 : -1;
          }
          const yDist = (point.y - lPt.y) / v.y;
          const xFromYDist = lPt.x + yDist * v.x;
          if (point.x === xFromYDist) return 0;
          const xDist = (point.x - lPt.x) / v.x;
          const yFromXDist = lPt.y + xDist * v.y;
          if (point.y === yFromXDist) return 0;
          return point.y < yFromXDist ? -1 : 1;
        }
        /**
         * Given another segment, returns the first non-trivial intersection
         * between the two segments (in terms of sweep line ordering), if it exists.
         *
         * A 'non-trivial' intersection is one that will cause one or both of the
         * segments to be split(). As such, 'trivial' vs. 'non-trivial' intersection:
         *
         *   * endpoint of segA with endpoint of segB --> trivial
         *   * endpoint of segA with point along segB --> non-trivial
         *   * endpoint of segB with point along segA --> non-trivial
         *   * point along segA with point along segB --> non-trivial
         *
         * If no non-trivial intersection exists, return null
         * Else, return null.
         */
        getIntersection(other) {
          const tBbox = this.bbox();
          const oBbox = other.bbox();
          const bboxOverlap = getBboxOverlap(tBbox, oBbox);
          if (bboxOverlap === null) return null;
          const tlp = this.leftSE.point;
          const trp = this.rightSE.point;
          const olp = other.leftSE.point;
          const orp = other.rightSE.point;
          const touchesOtherLSE = isInBbox(tBbox, olp) && this.comparePoint(olp) === 0;
          const touchesThisLSE = isInBbox(oBbox, tlp) && other.comparePoint(tlp) === 0;
          const touchesOtherRSE = isInBbox(tBbox, orp) && this.comparePoint(orp) === 0;
          const touchesThisRSE = isInBbox(oBbox, trp) && other.comparePoint(trp) === 0;
          if (touchesThisLSE && touchesOtherLSE) {
            if (touchesThisRSE && !touchesOtherRSE) return trp;
            if (!touchesThisRSE && touchesOtherRSE) return orp;
            return null;
          }
          if (touchesThisLSE) {
            if (touchesOtherRSE) {
              if (tlp.x === orp.x && tlp.y === orp.y) return null;
            }
            return tlp;
          }
          if (touchesOtherLSE) {
            if (touchesThisRSE) {
              if (trp.x === olp.x && trp.y === olp.y) return null;
            }
            return olp;
          }
          if (touchesThisRSE && touchesOtherRSE) return null;
          if (touchesThisRSE) return trp;
          if (touchesOtherRSE) return orp;
          const pt = intersection$1(tlp, this.vector(), olp, other.vector());
          if (pt === null) return null;
          if (!isInBbox(bboxOverlap, pt)) return null;
          return rounder.round(pt.x, pt.y);
        }
        /**
         * Split the given segment into multiple segments on the given points.
         *  * Each existing segment will retain its leftSE and a new rightSE will be
         *    generated for it.
         *  * A new segment will be generated which will adopt the original segment's
         *    rightSE, and a new leftSE will be generated for it.
         *  * If there are more than two points given to split on, new segments
         *    in the middle will be generated with new leftSE and rightSE's.
         *  * An array of the newly generated SweepEvents will be returned.
         *
         * Warning: input array of points is modified
         */
        split(point) {
          const newEvents = [];
          const alreadyLinked = point.events !== void 0;
          const newLeftSE = new SweepEvent(point, true);
          const newRightSE = new SweepEvent(point, false);
          const oldRightSE = this.rightSE;
          this.replaceRightSE(newRightSE);
          newEvents.push(newRightSE);
          newEvents.push(newLeftSE);
          const newSeg = new Segment(newLeftSE, oldRightSE, this.rings.slice(), this.windings.slice());
          if (SweepEvent.comparePoints(newSeg.leftSE.point, newSeg.rightSE.point) > 0) {
            newSeg.swapEvents();
          }
          if (SweepEvent.comparePoints(this.leftSE.point, this.rightSE.point) > 0) {
            this.swapEvents();
          }
          if (alreadyLinked) {
            newLeftSE.checkForConsuming();
            newRightSE.checkForConsuming();
          }
          return newEvents;
        }
        /* Swap which event is left and right */
        swapEvents() {
          const tmpEvt = this.rightSE;
          this.rightSE = this.leftSE;
          this.leftSE = tmpEvt;
          this.leftSE.isLeft = true;
          this.rightSE.isLeft = false;
          for (let i = 0, iMax = this.windings.length; i < iMax; i++) {
            this.windings[i] *= -1;
          }
        }
        /* Consume another segment. We take their rings under our wing
         * and mark them as consumed. Use for perfectly overlapping segments */
        consume(other) {
          let consumer = this;
          let consumee = other;
          while (consumer.consumedBy) consumer = consumer.consumedBy;
          while (consumee.consumedBy) consumee = consumee.consumedBy;
          const cmp2 = Segment.compare(consumer, consumee);
          if (cmp2 === 0) return;
          if (cmp2 > 0) {
            const tmp = consumer;
            consumer = consumee;
            consumee = tmp;
          }
          if (consumer.prev === consumee) {
            const tmp = consumer;
            consumer = consumee;
            consumee = tmp;
          }
          for (let i = 0, iMax = consumee.rings.length; i < iMax; i++) {
            const ring = consumee.rings[i];
            const winding = consumee.windings[i];
            const index2 = consumer.rings.indexOf(ring);
            if (index2 === -1) {
              consumer.rings.push(ring);
              consumer.windings.push(winding);
            } else consumer.windings[index2] += winding;
          }
          consumee.rings = null;
          consumee.windings = null;
          consumee.consumedBy = consumer;
          consumee.leftSE.consumedBy = consumer.leftSE;
          consumee.rightSE.consumedBy = consumer.rightSE;
        }
        /* The first segment previous segment chain that is in the result */
        prevInResult() {
          if (this._prevInResult !== void 0) return this._prevInResult;
          if (!this.prev) this._prevInResult = null;
          else if (this.prev.isInResult()) this._prevInResult = this.prev;
          else this._prevInResult = this.prev.prevInResult();
          return this._prevInResult;
        }
        beforeState() {
          if (this._beforeState !== void 0) return this._beforeState;
          if (!this.prev) this._beforeState = {
            rings: [],
            windings: [],
            multiPolys: []
          };
          else {
            const seg = this.prev.consumedBy || this.prev;
            this._beforeState = seg.afterState();
          }
          return this._beforeState;
        }
        afterState() {
          if (this._afterState !== void 0) return this._afterState;
          const beforeState = this.beforeState();
          this._afterState = {
            rings: beforeState.rings.slice(0),
            windings: beforeState.windings.slice(0),
            multiPolys: []
          };
          const ringsAfter = this._afterState.rings;
          const windingsAfter = this._afterState.windings;
          const mpsAfter = this._afterState.multiPolys;
          for (let i = 0, iMax = this.rings.length; i < iMax; i++) {
            const ring = this.rings[i];
            const winding = this.windings[i];
            const index2 = ringsAfter.indexOf(ring);
            if (index2 === -1) {
              ringsAfter.push(ring);
              windingsAfter.push(winding);
            } else windingsAfter[index2] += winding;
          }
          const polysAfter = [];
          const polysExclude = [];
          for (let i = 0, iMax = ringsAfter.length; i < iMax; i++) {
            if (windingsAfter[i] === 0) continue;
            const ring = ringsAfter[i];
            const poly = ring.poly;
            if (polysExclude.indexOf(poly) !== -1) continue;
            if (ring.isExterior) polysAfter.push(poly);
            else {
              if (polysExclude.indexOf(poly) === -1) polysExclude.push(poly);
              const index2 = polysAfter.indexOf(ring.poly);
              if (index2 !== -1) polysAfter.splice(index2, 1);
            }
          }
          for (let i = 0, iMax = polysAfter.length; i < iMax; i++) {
            const mp = polysAfter[i].multiPoly;
            if (mpsAfter.indexOf(mp) === -1) mpsAfter.push(mp);
          }
          return this._afterState;
        }
        /* Is this segment part of the final result? */
        isInResult() {
          if (this.consumedBy) return false;
          if (this._isInResult !== void 0) return this._isInResult;
          const mpsBefore = this.beforeState().multiPolys;
          const mpsAfter = this.afterState().multiPolys;
          switch (operation.type) {
            case "union": {
              const noBefores = mpsBefore.length === 0;
              const noAfters = mpsAfter.length === 0;
              this._isInResult = noBefores !== noAfters;
              break;
            }
            case "intersection": {
              let least;
              let most;
              if (mpsBefore.length < mpsAfter.length) {
                least = mpsBefore.length;
                most = mpsAfter.length;
              } else {
                least = mpsAfter.length;
                most = mpsBefore.length;
              }
              this._isInResult = most === operation.numMultiPolys && least < most;
              break;
            }
            case "xor": {
              const diff = Math.abs(mpsBefore.length - mpsAfter.length);
              this._isInResult = diff % 2 === 1;
              break;
            }
            case "difference": {
              const isJustSubject = (mps) => mps.length === 1 && mps[0].isSubject;
              this._isInResult = isJustSubject(mpsBefore) !== isJustSubject(mpsAfter);
              break;
            }
            default:
              throw new Error(`Unrecognized operation type found ${operation.type}`);
          }
          return this._isInResult;
        }
      }
      class RingIn {
        constructor(geomRing, poly, isExterior) {
          if (!Array.isArray(geomRing) || geomRing.length === 0) {
            throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
          }
          this.poly = poly;
          this.isExterior = isExterior;
          this.segments = [];
          if (typeof geomRing[0][0] !== "number" || typeof geomRing[0][1] !== "number") {
            throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
          }
          const firstPoint = rounder.round(geomRing[0][0], geomRing[0][1]);
          this.bbox = {
            ll: {
              x: firstPoint.x,
              y: firstPoint.y
            },
            ur: {
              x: firstPoint.x,
              y: firstPoint.y
            }
          };
          let prevPoint = firstPoint;
          for (let i = 1, iMax = geomRing.length; i < iMax; i++) {
            if (typeof geomRing[i][0] !== "number" || typeof geomRing[i][1] !== "number") {
              throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
            }
            let point = rounder.round(geomRing[i][0], geomRing[i][1]);
            if (point.x === prevPoint.x && point.y === prevPoint.y) continue;
            this.segments.push(Segment.fromRing(prevPoint, point, this));
            if (point.x < this.bbox.ll.x) this.bbox.ll.x = point.x;
            if (point.y < this.bbox.ll.y) this.bbox.ll.y = point.y;
            if (point.x > this.bbox.ur.x) this.bbox.ur.x = point.x;
            if (point.y > this.bbox.ur.y) this.bbox.ur.y = point.y;
            prevPoint = point;
          }
          if (firstPoint.x !== prevPoint.x || firstPoint.y !== prevPoint.y) {
            this.segments.push(Segment.fromRing(prevPoint, firstPoint, this));
          }
        }
        getSweepEvents() {
          const sweepEvents = [];
          for (let i = 0, iMax = this.segments.length; i < iMax; i++) {
            const segment = this.segments[i];
            sweepEvents.push(segment.leftSE);
            sweepEvents.push(segment.rightSE);
          }
          return sweepEvents;
        }
      }
      class PolyIn {
        constructor(geomPoly, multiPoly) {
          if (!Array.isArray(geomPoly)) {
            throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
          }
          this.exteriorRing = new RingIn(geomPoly[0], this, true);
          this.bbox = {
            ll: {
              x: this.exteriorRing.bbox.ll.x,
              y: this.exteriorRing.bbox.ll.y
            },
            ur: {
              x: this.exteriorRing.bbox.ur.x,
              y: this.exteriorRing.bbox.ur.y
            }
          };
          this.interiorRings = [];
          for (let i = 1, iMax = geomPoly.length; i < iMax; i++) {
            const ring = new RingIn(geomPoly[i], this, false);
            if (ring.bbox.ll.x < this.bbox.ll.x) this.bbox.ll.x = ring.bbox.ll.x;
            if (ring.bbox.ll.y < this.bbox.ll.y) this.bbox.ll.y = ring.bbox.ll.y;
            if (ring.bbox.ur.x > this.bbox.ur.x) this.bbox.ur.x = ring.bbox.ur.x;
            if (ring.bbox.ur.y > this.bbox.ur.y) this.bbox.ur.y = ring.bbox.ur.y;
            this.interiorRings.push(ring);
          }
          this.multiPoly = multiPoly;
        }
        getSweepEvents() {
          const sweepEvents = this.exteriorRing.getSweepEvents();
          for (let i = 0, iMax = this.interiorRings.length; i < iMax; i++) {
            const ringSweepEvents = this.interiorRings[i].getSweepEvents();
            for (let j = 0, jMax = ringSweepEvents.length; j < jMax; j++) {
              sweepEvents.push(ringSweepEvents[j]);
            }
          }
          return sweepEvents;
        }
      }
      class MultiPolyIn {
        constructor(geom, isSubject) {
          if (!Array.isArray(geom)) {
            throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
          }
          try {
            if (typeof geom[0][0][0] === "number") geom = [geom];
          } catch (ex) {
          }
          this.polys = [];
          this.bbox = {
            ll: {
              x: Number.POSITIVE_INFINITY,
              y: Number.POSITIVE_INFINITY
            },
            ur: {
              x: Number.NEGATIVE_INFINITY,
              y: Number.NEGATIVE_INFINITY
            }
          };
          for (let i = 0, iMax = geom.length; i < iMax; i++) {
            const poly = new PolyIn(geom[i], this);
            if (poly.bbox.ll.x < this.bbox.ll.x) this.bbox.ll.x = poly.bbox.ll.x;
            if (poly.bbox.ll.y < this.bbox.ll.y) this.bbox.ll.y = poly.bbox.ll.y;
            if (poly.bbox.ur.x > this.bbox.ur.x) this.bbox.ur.x = poly.bbox.ur.x;
            if (poly.bbox.ur.y > this.bbox.ur.y) this.bbox.ur.y = poly.bbox.ur.y;
            this.polys.push(poly);
          }
          this.isSubject = isSubject;
        }
        getSweepEvents() {
          const sweepEvents = [];
          for (let i = 0, iMax = this.polys.length; i < iMax; i++) {
            const polySweepEvents = this.polys[i].getSweepEvents();
            for (let j = 0, jMax = polySweepEvents.length; j < jMax; j++) {
              sweepEvents.push(polySweepEvents[j]);
            }
          }
          return sweepEvents;
        }
      }
      class RingOut {
        /* Given the segments from the sweep line pass, compute & return a series
         * of closed rings from all the segments marked to be part of the result */
        static factory(allSegments) {
          const ringsOut = [];
          for (let i = 0, iMax = allSegments.length; i < iMax; i++) {
            const segment = allSegments[i];
            if (!segment.isInResult() || segment.ringOut) continue;
            let prevEvent = null;
            let event = segment.leftSE;
            let nextEvent = segment.rightSE;
            const events = [event];
            const startingPoint = event.point;
            const intersectionLEs = [];
            while (true) {
              prevEvent = event;
              event = nextEvent;
              events.push(event);
              if (event.point === startingPoint) break;
              while (true) {
                const availableLEs = event.getAvailableLinkedEvents();
                if (availableLEs.length === 0) {
                  const firstPt = events[0].point;
                  const lastPt = events[events.length - 1].point;
                  throw new Error(`Unable to complete output ring starting at [${firstPt.x}, ${firstPt.y}]. Last matching segment found ends at [${lastPt.x}, ${lastPt.y}].`);
                }
                if (availableLEs.length === 1) {
                  nextEvent = availableLEs[0].otherSE;
                  break;
                }
                let indexLE = null;
                for (let j = 0, jMax = intersectionLEs.length; j < jMax; j++) {
                  if (intersectionLEs[j].point === event.point) {
                    indexLE = j;
                    break;
                  }
                }
                if (indexLE !== null) {
                  const intersectionLE = intersectionLEs.splice(indexLE)[0];
                  const ringEvents = events.splice(intersectionLE.index);
                  ringEvents.unshift(ringEvents[0].otherSE);
                  ringsOut.push(new RingOut(ringEvents.reverse()));
                  continue;
                }
                intersectionLEs.push({
                  index: events.length,
                  point: event.point
                });
                const comparator = event.getLeftmostComparator(prevEvent);
                nextEvent = availableLEs.sort(comparator)[0].otherSE;
                break;
              }
            }
            ringsOut.push(new RingOut(events));
          }
          return ringsOut;
        }
        constructor(events) {
          this.events = events;
          for (let i = 0, iMax = events.length; i < iMax; i++) {
            events[i].segment.ringOut = this;
          }
          this.poly = null;
        }
        getGeom() {
          let prevPt = this.events[0].point;
          const points = [prevPt];
          for (let i = 1, iMax = this.events.length - 1; i < iMax; i++) {
            const pt2 = this.events[i].point;
            const nextPt2 = this.events[i + 1].point;
            if (compareVectorAngles(pt2, prevPt, nextPt2) === 0) continue;
            points.push(pt2);
            prevPt = pt2;
          }
          if (points.length === 1) return null;
          const pt = points[0];
          const nextPt = points[1];
          if (compareVectorAngles(pt, prevPt, nextPt) === 0) points.shift();
          points.push(points[0]);
          const step = this.isExteriorRing() ? 1 : -1;
          const iStart = this.isExteriorRing() ? 0 : points.length - 1;
          const iEnd = this.isExteriorRing() ? points.length : -1;
          const orderedPoints = [];
          for (let i = iStart; i != iEnd; i += step) orderedPoints.push([points[i].x, points[i].y]);
          return orderedPoints;
        }
        isExteriorRing() {
          if (this._isExteriorRing === void 0) {
            const enclosing = this.enclosingRing();
            this._isExteriorRing = enclosing ? !enclosing.isExteriorRing() : true;
          }
          return this._isExteriorRing;
        }
        enclosingRing() {
          if (this._enclosingRing === void 0) {
            this._enclosingRing = this._calcEnclosingRing();
          }
          return this._enclosingRing;
        }
        /* Returns the ring that encloses this one, if any */
        _calcEnclosingRing() {
          let leftMostEvt = this.events[0];
          for (let i = 1, iMax = this.events.length; i < iMax; i++) {
            const evt = this.events[i];
            if (SweepEvent.compare(leftMostEvt, evt) > 0) leftMostEvt = evt;
          }
          let prevSeg = leftMostEvt.segment.prevInResult();
          let prevPrevSeg = prevSeg ? prevSeg.prevInResult() : null;
          while (true) {
            if (!prevSeg) return null;
            if (!prevPrevSeg) return prevSeg.ringOut;
            if (prevPrevSeg.ringOut !== prevSeg.ringOut) {
              if (prevPrevSeg.ringOut.enclosingRing() !== prevSeg.ringOut) {
                return prevSeg.ringOut;
              } else return prevSeg.ringOut.enclosingRing();
            }
            prevSeg = prevPrevSeg.prevInResult();
            prevPrevSeg = prevSeg ? prevSeg.prevInResult() : null;
          }
        }
      }
      class PolyOut {
        constructor(exteriorRing) {
          this.exteriorRing = exteriorRing;
          exteriorRing.poly = this;
          this.interiorRings = [];
        }
        addInterior(ring) {
          this.interiorRings.push(ring);
          ring.poly = this;
        }
        getGeom() {
          const geom = [this.exteriorRing.getGeom()];
          if (geom[0] === null) return null;
          for (let i = 0, iMax = this.interiorRings.length; i < iMax; i++) {
            const ringGeom = this.interiorRings[i].getGeom();
            if (ringGeom === null) continue;
            geom.push(ringGeom);
          }
          return geom;
        }
      }
      class MultiPolyOut {
        constructor(rings) {
          this.rings = rings;
          this.polys = this._composePolys(rings);
        }
        getGeom() {
          const geom = [];
          for (let i = 0, iMax = this.polys.length; i < iMax; i++) {
            const polyGeom = this.polys[i].getGeom();
            if (polyGeom === null) continue;
            geom.push(polyGeom);
          }
          return geom;
        }
        _composePolys(rings) {
          const polys = [];
          for (let i = 0, iMax = rings.length; i < iMax; i++) {
            const ring = rings[i];
            if (ring.poly) continue;
            if (ring.isExteriorRing()) polys.push(new PolyOut(ring));
            else {
              const enclosingRing = ring.enclosingRing();
              if (!enclosingRing.poly) polys.push(new PolyOut(enclosingRing));
              enclosingRing.poly.addInterior(ring);
            }
          }
          return polys;
        }
      }
      class SweepLine {
        constructor(queue) {
          let comparator = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : Segment.compare;
          this.queue = queue;
          this.tree = new Tree(comparator);
          this.segments = [];
        }
        process(event) {
          const segment = event.segment;
          const newEvents = [];
          if (event.consumedBy) {
            if (event.isLeft) this.queue.remove(event.otherSE);
            else this.tree.remove(segment);
            return newEvents;
          }
          const node = event.isLeft ? this.tree.add(segment) : this.tree.find(segment);
          if (!node) throw new Error(`Unable to find segment #${segment.id} [${segment.leftSE.point.x}, ${segment.leftSE.point.y}] -> [${segment.rightSE.point.x}, ${segment.rightSE.point.y}] in SweepLine tree.`);
          let prevNode = node;
          let nextNode = node;
          let prevSeg = void 0;
          let nextSeg = void 0;
          while (prevSeg === void 0) {
            prevNode = this.tree.prev(prevNode);
            if (prevNode === null) prevSeg = null;
            else if (prevNode.key.consumedBy === void 0) prevSeg = prevNode.key;
          }
          while (nextSeg === void 0) {
            nextNode = this.tree.next(nextNode);
            if (nextNode === null) nextSeg = null;
            else if (nextNode.key.consumedBy === void 0) nextSeg = nextNode.key;
          }
          if (event.isLeft) {
            let prevMySplitter = null;
            if (prevSeg) {
              const prevInter = prevSeg.getIntersection(segment);
              if (prevInter !== null) {
                if (!segment.isAnEndpoint(prevInter)) prevMySplitter = prevInter;
                if (!prevSeg.isAnEndpoint(prevInter)) {
                  const newEventsFromSplit = this._splitSafely(prevSeg, prevInter);
                  for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
                    newEvents.push(newEventsFromSplit[i]);
                  }
                }
              }
            }
            let nextMySplitter = null;
            if (nextSeg) {
              const nextInter = nextSeg.getIntersection(segment);
              if (nextInter !== null) {
                if (!segment.isAnEndpoint(nextInter)) nextMySplitter = nextInter;
                if (!nextSeg.isAnEndpoint(nextInter)) {
                  const newEventsFromSplit = this._splitSafely(nextSeg, nextInter);
                  for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
                    newEvents.push(newEventsFromSplit[i]);
                  }
                }
              }
            }
            if (prevMySplitter !== null || nextMySplitter !== null) {
              let mySplitter = null;
              if (prevMySplitter === null) mySplitter = nextMySplitter;
              else if (nextMySplitter === null) mySplitter = prevMySplitter;
              else {
                const cmpSplitters = SweepEvent.comparePoints(prevMySplitter, nextMySplitter);
                mySplitter = cmpSplitters <= 0 ? prevMySplitter : nextMySplitter;
              }
              this.queue.remove(segment.rightSE);
              newEvents.push(segment.rightSE);
              const newEventsFromSplit = segment.split(mySplitter);
              for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
                newEvents.push(newEventsFromSplit[i]);
              }
            }
            if (newEvents.length > 0) {
              this.tree.remove(segment);
              newEvents.push(event);
            } else {
              this.segments.push(segment);
              segment.prev = prevSeg;
            }
          } else {
            if (prevSeg && nextSeg) {
              const inter = prevSeg.getIntersection(nextSeg);
              if (inter !== null) {
                if (!prevSeg.isAnEndpoint(inter)) {
                  const newEventsFromSplit = this._splitSafely(prevSeg, inter);
                  for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
                    newEvents.push(newEventsFromSplit[i]);
                  }
                }
                if (!nextSeg.isAnEndpoint(inter)) {
                  const newEventsFromSplit = this._splitSafely(nextSeg, inter);
                  for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
                    newEvents.push(newEventsFromSplit[i]);
                  }
                }
              }
            }
            this.tree.remove(segment);
          }
          return newEvents;
        }
        /* Safely split a segment that is currently in the datastructures
         * IE - a segment other than the one that is currently being processed. */
        _splitSafely(seg, pt) {
          this.tree.remove(seg);
          const rightSE = seg.rightSE;
          this.queue.remove(rightSE);
          const newEvents = seg.split(pt);
          newEvents.push(rightSE);
          if (seg.consumedBy === void 0) this.tree.add(seg);
          return newEvents;
        }
      }
      const POLYGON_CLIPPING_MAX_QUEUE_SIZE = typeof process !== "undefined" && process.env.POLYGON_CLIPPING_MAX_QUEUE_SIZE || 1e6;
      const POLYGON_CLIPPING_MAX_SWEEPLINE_SEGMENTS = typeof process !== "undefined" && process.env.POLYGON_CLIPPING_MAX_SWEEPLINE_SEGMENTS || 1e6;
      class Operation {
        run(type, geom, moreGeoms) {
          operation.type = type;
          rounder.reset();
          const multipolys = [new MultiPolyIn(geom, true)];
          for (let i = 0, iMax = moreGeoms.length; i < iMax; i++) {
            multipolys.push(new MultiPolyIn(moreGeoms[i], false));
          }
          operation.numMultiPolys = multipolys.length;
          if (operation.type === "difference") {
            const subject = multipolys[0];
            let i = 1;
            while (i < multipolys.length) {
              if (getBboxOverlap(multipolys[i].bbox, subject.bbox) !== null) i++;
              else multipolys.splice(i, 1);
            }
          }
          if (operation.type === "intersection") {
            for (let i = 0, iMax = multipolys.length; i < iMax; i++) {
              const mpA = multipolys[i];
              for (let j = i + 1, jMax = multipolys.length; j < jMax; j++) {
                if (getBboxOverlap(mpA.bbox, multipolys[j].bbox) === null) return [];
              }
            }
          }
          const queue = new Tree(SweepEvent.compare);
          for (let i = 0, iMax = multipolys.length; i < iMax; i++) {
            const sweepEvents = multipolys[i].getSweepEvents();
            for (let j = 0, jMax = sweepEvents.length; j < jMax; j++) {
              queue.insert(sweepEvents[j]);
              if (queue.size > POLYGON_CLIPPING_MAX_QUEUE_SIZE) {
                throw new Error("Infinite loop when putting segment endpoints in a priority queue (queue size too big).");
              }
            }
          }
          const sweepLine = new SweepLine(queue);
          let prevQueueSize = queue.size;
          let node = queue.pop();
          while (node) {
            const evt = node.key;
            if (queue.size === prevQueueSize) {
              const seg = evt.segment;
              throw new Error(`Unable to pop() ${evt.isLeft ? "left" : "right"} SweepEvent [${evt.point.x}, ${evt.point.y}] from segment #${seg.id} [${seg.leftSE.point.x}, ${seg.leftSE.point.y}] -> [${seg.rightSE.point.x}, ${seg.rightSE.point.y}] from queue.`);
            }
            if (queue.size > POLYGON_CLIPPING_MAX_QUEUE_SIZE) {
              throw new Error("Infinite loop when passing sweep line over endpoints (queue size too big).");
            }
            if (sweepLine.segments.length > POLYGON_CLIPPING_MAX_SWEEPLINE_SEGMENTS) {
              throw new Error("Infinite loop when passing sweep line over endpoints (too many sweep line segments).");
            }
            const newEvents = sweepLine.process(evt);
            for (let i = 0, iMax = newEvents.length; i < iMax; i++) {
              const evt2 = newEvents[i];
              if (evt2.consumedBy === void 0) queue.insert(evt2);
            }
            prevQueueSize = queue.size;
            node = queue.pop();
          }
          rounder.reset();
          const ringsOut = RingOut.factory(sweepLine.segments);
          const result = new MultiPolyOut(ringsOut);
          return result.getGeom();
        }
      }
      const operation = new Operation();
      const union = function(geom) {
        for (var _len = arguments.length, moreGeoms = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
          moreGeoms[_key - 1] = arguments[_key];
        }
        return operation.run("union", geom, moreGeoms);
      };
      const intersection = function(geom) {
        for (var _len2 = arguments.length, moreGeoms = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
          moreGeoms[_key2 - 1] = arguments[_key2];
        }
        return operation.run("intersection", geom, moreGeoms);
      };
      const xor = function(geom) {
        for (var _len3 = arguments.length, moreGeoms = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
          moreGeoms[_key3 - 1] = arguments[_key3];
        }
        return operation.run("xor", geom, moreGeoms);
      };
      const difference = function(subjectGeom) {
        for (var _len4 = arguments.length, clippingGeoms = new Array(_len4 > 1 ? _len4 - 1 : 0), _key4 = 1; _key4 < _len4; _key4++) {
          clippingGeoms[_key4 - 1] = arguments[_key4];
        }
        return operation.run("difference", subjectGeom, clippingGeoms);
      };
      var index = {
        union,
        intersection,
        xor,
        difference
      };
      return index;
    }));
  }
});

// src/layout-split.ts
var STORAGE_KEY = "app-gevelwering-sidebar-width-px";
var MIN_SIDEBAR_PX = 260;
var MIN_VIEWER_PX = 280;
var DEFAULT_SIDEBAR_PX = 420;
function clampSidebarWidth(layout, widthPx) {
  const rect = layout.getBoundingClientRect();
  const handle = layout.querySelector(".engineer-split-handle");
  const handleW = handle?.offsetWidth ?? 8;
  if (rect.width < MIN_SIDEBAR_PX + MIN_VIEWER_PX + handleW) {
    return Math.min(Math.max(widthPx, MIN_SIDEBAR_PX), 760);
  }
  const max = Math.max(MIN_SIDEBAR_PX, rect.width - MIN_VIEWER_PX - handleW);
  return Math.min(Math.max(widthPx, MIN_SIDEBAR_PX), max);
}
function applySidebarWidth(layout, widthPx) {
  const clamped = clampSidebarWidth(layout, widthPx);
  layout.style.setProperty("--engineer-sidebar-width", `${Math.round(clamped)}px`);
}
function getEngineerSidebarWidthPx(root = document) {
  const layout = root.querySelector(".engineer-layout");
  if (layout) {
    const current = Number.parseFloat(
      getComputedStyle(layout).getPropertyValue("--engineer-sidebar-width")
    );
    if (Number.isFinite(current) && current > 0) return Math.round(current);
  }
  const stored = Number(localStorage.getItem(STORAGE_KEY));
  if (Number.isFinite(stored) && stored > 0) return Math.round(stored);
  return null;
}
function setEngineerSidebarWidthPx(widthPx, root = document) {
  const layout = root.querySelector(".engineer-layout");
  if (!layout || !(widthPx > 0)) return;
  applySidebarWidth(layout, widthPx);
  const applied = Number.parseFloat(
    getComputedStyle(layout).getPropertyValue("--engineer-sidebar-width")
  );
  if (Number.isFinite(applied) && applied > 0) {
    localStorage.setItem(STORAGE_KEY, String(Math.round(applied)));
  }
}
function initEngineerLayoutSplit(root = document) {
  const layout = root.querySelector(".engineer-layout");
  const handle = root.querySelector(".engineer-split-handle");
  if (!layout || !handle) return;
  const stored = Number(localStorage.getItem(STORAGE_KEY));
  const initial = Number.isFinite(stored) && stored > 0 ? stored : DEFAULT_SIDEBAR_PX;
  applySidebarWidth(layout, initial);
  const onResize = () => {
    const current = Number.parseFloat(
      getComputedStyle(layout).getPropertyValue("--engineer-sidebar-width")
    );
    if (Number.isFinite(current) && current > 0) applySidebarWidth(layout, current);
  };
  window.addEventListener("resize", onResize);
  let dragging = false;
  let pointerId = null;
  const endDrag = (evt) => {
    if (!dragging) return;
    dragging = false;
    layout.classList.remove("is-resizing");
    document.body.classList.remove("engineer-resizing");
    if (evt && pointerId != null) {
      try {
        handle.releasePointerCapture(pointerId);
      } catch {
      }
    }
    pointerId = null;
    const current = Number.parseFloat(
      getComputedStyle(layout).getPropertyValue("--engineer-sidebar-width")
    );
    if (Number.isFinite(current) && current > 0) {
      localStorage.setItem(STORAGE_KEY, String(Math.round(current)));
    }
  };
  handle.addEventListener("pointerdown", (evt) => {
    if (evt.button !== 0) return;
    if (window.matchMedia("(max-width: 1100px)").matches) return;
    evt.preventDefault();
    dragging = true;
    pointerId = evt.pointerId;
    layout.classList.add("is-resizing");
    document.body.classList.add("engineer-resizing");
    handle.setPointerCapture(evt.pointerId);
  });
  handle.addEventListener("pointermove", (evt) => {
    if (!dragging) return;
    const rect = layout.getBoundingClientRect();
    applySidebarWidth(layout, rect.right - evt.clientX);
  });
  handle.addEventListener("pointerup", endDrag);
  handle.addEventListener("pointercancel", endDrag);
  handle.addEventListener("lostpointercapture", () => {
    if (dragging) endDrag();
  });
}

// src/geom.ts
function shoelaceArea(points) {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}
function polylinePerimeter(points) {
  if (points.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return sum;
}
function openPolylineLength(points) {
  if (points.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    sum += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return sum;
}
function clampPath(points) {
  return points.map((p) => ({
    x: Math.min(1, Math.max(0, p.x)),
    y: Math.min(1, Math.max(0, p.y))
  }));
}
function closeRing(points) {
  const out = points.map((p) => ({
    x: Math.min(1, Math.max(0, p.x)),
    y: Math.min(1, Math.max(0, p.y))
  }));
  if (out.length < 1) return out;
  const f = out[0];
  const l = out[out.length - 1];
  if (Math.hypot(f.x - l.x, f.y - l.y) > 1e-6) out.push({ ...f });
  return out;
}
function translateRing(points, dx, dy) {
  return closeRing(points.map((p) => ({ x: p.x + dx, y: p.y + dy })));
}
function translateRingUnclamped(points, dx, dy) {
  if (!points.length) return [];
  const out = points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
  if (out.length >= 2) {
    const pf = points[0];
    const pl = points[points.length - 1];
    if (Math.hypot(pf.x - pl.x, pf.y - pl.y) < 1e-6) {
      out[out.length - 1] = { ...out[0] };
    }
  }
  return out;
}
function ringVertexCount(points) {
  if (points.length < 2) return points.length;
  const f = points[0];
  const l = points[points.length - 1];
  if (Math.hypot(f.x - l.x, f.y - l.y) < 1e-6) return points.length - 1;
  return points.length;
}
function densifyRing(points, segmentsPerEdge) {
  const nSeg = Math.max(1, Math.floor(segmentsPerEdge));
  const count = ringVertexCount(points);
  if (count < 2 || nSeg <= 1) return closeRing(points);
  const ring = points.slice(0, count);
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    out.push({ x: a.x, y: a.y });
    for (let s = 1; s < nSeg; s++) {
      const t = s / nSeg;
      out.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t
      });
    }
  }
  return closeRing(out);
}
function ensureEditablePolyline(points, minVertices = 16) {
  const ring = closeRing(points);
  const n = ringVertexCount(ring);
  if (n >= minVertices) return ring;
  const segs = Math.max(2, Math.ceil(minVertices / Math.max(1, n)));
  return densifyRing(ring, segs);
}
function removeRingVertex(points, index) {
  const n = ringVertexCount(points);
  if (n <= 3) return null;
  if (index < 0 || index >= n) return null;
  const ring = points.slice(0, n);
  ring.splice(index, 1);
  return closeRing(ring);
}
function insertRingVertex(points, afterIndex, pt) {
  const n = ringVertexCount(points);
  if (n < 2) return null;
  if (afterIndex < 0 || afterIndex >= n) return null;
  const ring = points.slice(0, n);
  ring.splice(afterIndex + 1, 0, { x: pt.x, y: pt.y });
  return closeRing(ring);
}
function simplifyEditableRing(points, epsilon = 6e-3) {
  const before = ringVertexCount(points);
  if (before <= 3) return closeRing(points);
  const simplified = rdpSimplify(points, Math.max(1e-6, epsilon));
  if (ringVertexCount(simplified) < 3) return closeRing(points);
  return simplified;
}
function rdpSimplify(points, epsilon) {
  if (points.length < 3) return points.slice();
  const closed = Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y) < 1e-9;
  const ring = closed ? points.slice(0, -1) : points.slice();
  if (ring.length < 3) {
    const out2 = ring.map((p) => ({ x: p.x, y: p.y }));
    if (out2.length && Math.hypot(out2[0].x - out2[out2.length - 1].x, out2[0].y - out2[out2.length - 1].y) > 1e-6) {
      out2.push({ ...out2[0] });
    }
    return out2;
  }
  function distSeg(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-18) return Math.hypot(p.x - a.x, p.y - a.y);
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  }
  function rec(pts) {
    if (pts.length < 3) return pts.slice();
    let maxD = 0;
    let idx = 0;
    const a = pts[0];
    const b = pts[pts.length - 1];
    for (let i = 1; i < pts.length - 1; i++) {
      const d = distSeg(pts[i], a, b);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > epsilon) {
      const left = rec(pts.slice(0, idx + 1));
      const right = rec(pts.slice(idx));
      return left.slice(0, -1).concat(right);
    }
    return [a, b];
  }
  const simplified = rec(ring);
  if (!simplified.length) return [];
  const out = simplified.map((p) => ({ x: p.x, y: p.y }));
  const f = out[0];
  const l = out[out.length - 1];
  if (Math.hypot(f.x - l.x, f.y - l.y) > 1e-6) out.push({ ...f });
  return out;
}
function normalizeAspectYx(aspectYx) {
  if (aspectYx == null || !Number.isFinite(aspectYx) || aspectYx <= 0) return 1;
  return aspectYx;
}
function scaleAxes(metresPerNorm, aspectYx) {
  const a = normalizeAspectYx(aspectYx);
  return { mx: metresPerNorm, my: metresPerNorm * a };
}
function scaledSegmentLength(dx, dy, metresPerNorm, aspectYx) {
  const { mx, my } = scaleAxes(metresPerNorm, aspectYx);
  return Math.hypot(dx * mx, dy * my);
}
function scaledPathLength(points, metresPerNorm, aspectYx, closed = false) {
  if (points.length < 2) return 0;
  let sum = 0;
  const n = closed ? points.length : points.length - 1;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += scaledSegmentLength(b.x - a.x, b.y - a.y, metresPerNorm, aspectYx);
  }
  return sum;
}
function scaledAreaM2(areaNorm, metresPerNorm, aspectYx) {
  const { mx, my } = scaleAxes(metresPerNorm, aspectYx);
  return areaNorm * mx * my;
}
function metresPerNormFromCalibration(lengthMetres, a, b, aspectYx) {
  const dist = Math.hypot(b.x - a.x, (b.y - a.y) * normalizeAspectYx(aspectYx));
  if (!(dist > 1e-12) || !(lengthMetres > 0)) return NaN;
  return lengthMetres / dist;
}
function parseScaleRatioFromText(text) {
  const m = text.match(/\b1\s*[:/]\s*(\d+(?:[.,]\d+)?)\b/);
  if (!m) return null;
  const n = Number(String(m[1]).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}
function metresPerNormFromPaperScale(scaleRatio, cropWidthPdfPoints) {
  const widthMetresOnPaper = cropWidthPdfPoints / 72 * 0.0254;
  return widthMetresOnPaper * scaleRatio;
}

// src/polygon-boolean.ts
var import_polygon_clipping = __toESM(require_polygon_clipping_umd(), 1);
var AREA_EPS = 1e-10;
var CONTAIN_EPS = 1e-8;
function ringToPc(points) {
  const closed = closeRing(points);
  const ring = closed.map((p) => [p.x, p.y]);
  if (ring.length >= 1) {
    const a = ring[0];
    const b = ring[ring.length - 1];
    if (a[0] !== b[0] || a[1] !== b[1]) ring.push([a[0], a[1]]);
  }
  return ring;
}
function ptsFromRing(ring) {
  return closeRing(ring.map(([x, y]) => ({ x, y })));
}
function netAreaNorm(outer, holes) {
  const holesSum = holes.reduce((s, h) => s + shoelaceArea(h), 0);
  return Math.max(0, shoelaceArea(outer) - holesSum);
}
function resultToPolygons(multi) {
  const out = [];
  for (const poly of multi) {
    if (!poly || !poly.length) continue;
    const outerRing = poly[0];
    if (!outerRing || outerRing.length < 3) continue;
    const outer = ptsFromRing(outerRing);
    const holes = [];
    for (let i = 1; i < poly.length; i++) {
      const hole = poly[i];
      if (!hole || hole.length < 3) continue;
      const pts = ptsFromRing(hole);
      if (shoelaceArea(pts) > AREA_EPS) holes.push(pts);
    }
    const areaNorm = netAreaNorm(outer, holes);
    if (areaNorm > AREA_EPS) out.push({ outer, holes, areaNorm });
  }
  out.sort((a, b) => b.areaNorm - a.areaNorm);
  return out;
}
function multiArea(multi) {
  return resultToPolygons(multi).reduce((s, p) => s + p.areaNorm, 0);
}
function pointInRing(pt, ring) {
  const closed = closeRing(ring);
  const n = ringVertexCount(closed);
  if (n < 3) return false;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = closed[i];
    const b = closed[j];
    const onEdge = Math.abs((b.x - a.x) * (pt.y - a.y) - (b.y - a.y) * (pt.x - a.x)) < 1e-12 && pt.x >= Math.min(a.x, b.x) - 1e-12 && pt.x <= Math.max(a.x, b.x) + 1e-12 && pt.y >= Math.min(a.y, b.y) - 1e-12 && pt.y <= Math.max(a.y, b.y) + 1e-12;
    if (onEdge) return true;
    const intersect = a.y > pt.y !== b.y > pt.y && pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y + 1e-30) + a.x;
    if (intersect) inside = !inside;
  }
  return inside;
}
function ringFullyContained(inner, outer) {
  if (ringVertexCount(inner) < 3 || ringVertexCount(outer) < 3) return false;
  if (shoelaceArea(inner) < AREA_EPS || shoelaceArea(outer) < AREA_EPS) return false;
  const closedInner = closeRing(inner);
  const n = ringVertexCount(closedInner);
  for (let i = 0; i < n; i++) {
    if (!pointInRing(closedInner[i], outer)) return false;
  }
  try {
    const leftover = import_polygon_clipping.default.difference([ringToPc(inner)], [ringToPc(outer)]);
    return multiArea(leftover) <= CONTAIN_EPS;
  } catch {
    return false;
  }
}
function composeSigned(parts) {
  const plus = parts.filter((p) => p.sign === "+");
  const minus = parts.filter((p) => p.sign === "-");
  if (plus.length < 1) {
    throw new Error("Minstens \xE9\xE9n deel met + is verplicht");
  }
  const plusPolys = plus.map((p) => [ringToPc(p.ring)]);
  let result = plusPolys.length === 1 ? [plusPolys[0]] : import_polygon_clipping.default.union(plusPolys[0], ...plusPolys.slice(1));
  if (minus.length > 0) {
    const minusPolys = minus.map((p) => [ringToPc(p.ring)]);
    result = import_polygon_clipping.default.difference(result, ...minusPolys);
  }
  const out = resultToPolygons(result);
  if (out.length < 1) {
    throw new Error("Compositie is leeg (niets over na +/\u2212)");
  }
  return out[0];
}
function booleanCombine(op, rings) {
  if (op === "compose") {
    throw new Error("Gebruik composeSigned voor compose");
  }
  if (rings.length < 2) {
    throw new Error("Selecteer minstens 2 componenten");
  }
  let ordered = rings.slice();
  if (op === "difference") {
    ordered = ordered.sort((a, b) => shoelaceArea(b) - shoelaceArea(a));
  }
  const polys = ordered.map((r) => [ringToPc(r)]);
  let result;
  if (op === "union") {
    result = import_polygon_clipping.default.union(polys[0], ...polys.slice(1));
  } else if (op === "difference") {
    result = import_polygon_clipping.default.difference(polys[0], ...polys.slice(1));
  } else {
    result = import_polygon_clipping.default.intersection(polys[0], ...polys.slice(1));
  }
  const out = resultToPolygons(result);
  if (out.length < 1) {
    const msg = op === "intersect" ? "Doorsnede is leeg (geen overlapping)" : op === "difference" ? "Verschil is leeg (niets over na aftrek)" : "Vereniging leverde geen polygoon";
    throw new Error(msg);
  }
  return out;
}
function booleanCombineLargest(op, rings) {
  return booleanCombine(op, rings)[0];
}

// src/ga-vr-components.ts
function asAnalysis(analysis) {
  return analysis && typeof analysis === "object" ? analysis : {};
}
function collectBooleanSourceIds(subsections) {
  const ids = /* @__PURE__ */ new Set();
  for (const s of subsections) {
    const src = asAnalysis(s.analysis).source_subsection_ids;
    if (!Array.isArray(src)) continue;
    for (const id of src) {
      if (typeof id === "string" && id.trim()) ids.add(id.trim());
    }
  }
  return ids;
}
function collectSupersededSourceIds(subsections) {
  const superseded = /* @__PURE__ */ new Set();
  const byId = new Map(subsections.map((s) => [s.id, s]));
  for (const c of subsections) {
    const ca = asAnalysis(c.analysis);
    const src = ca.source_subsection_ids;
    if (!Array.isArray(src) || src.length < 2 || !ca.boolean_op) continue;
    const cMat = ca.material_id != null ? String(ca.material_id).trim() : "";
    const cCat = ca.master_category != null ? String(ca.master_category).trim().toLowerCase() : "";
    for (const sid of src) {
      if (typeof sid !== "string" || !sid.trim()) continue;
      const srcRow = byId.get(sid.trim());
      if (!srcRow) continue;
      const sa = asAnalysis(srcRow.analysis);
      const sMat = sa.material_id != null ? String(sa.material_id).trim() : "";
      const sCat = sa.master_category != null ? String(sa.master_category).trim().toLowerCase() : "";
      if (!sMat && !sCat) {
        superseded.add(sid.trim());
        continue;
      }
      if (cMat && sMat && cMat === sMat) {
        superseded.add(sid.trim());
        continue;
      }
      if (cCat && sCat && cCat === sCat) {
        superseded.add(sid.trim());
      }
    }
  }
  return superseded;
}
function hasMaterialId(analysis) {
  const mid = asAnalysis(analysis).material_id;
  return mid != null && String(mid).trim().length > 0;
}
function composeConstituentsMissingMaterial(component, subsections) {
  const ca = asAnalysis(component.analysis);
  const src = ca.source_subsection_ids;
  if (!ca.boolean_op || !Array.isArray(src) || src.length < 2) return [];
  const byId = new Map(subsections.map((s) => [s.id, s]));
  const missing = [];
  for (const sid of src) {
    if (typeof sid !== "string" || !sid.trim() || sid === component.id) continue;
    const child = byId.get(sid.trim());
    if (!child) continue;
    if (!hasMaterialId(child.analysis)) missing.push(child);
  }
  return missing;
}

// src/floormap-seal.ts
var KIER_SEAL_STROKE = "#e65100";
var KIER_SEAL_STROKE_SELECTED = "#ff9800";
var KIER_SEAL_STROKE_TOUCHED = "#f57c00";
function readComponentSeal(analysis) {
  const raw = analysis?.seal;
  if (!raw || typeof raw !== "object") return null;
  return {
    enabled: Boolean(raw.enabled),
    material_id: raw.material_id != null ? String(raw.material_id) : void 0,
    catalog_id: raw.catalog_id != null ? String(raw.catalog_id) : void 0,
    material_name: raw.material_name != null ? String(raw.material_name) : void 0,
    master_category: raw.master_category != null ? String(raw.master_category) : void 0,
    category: raw.category != null ? String(raw.category) : void 0,
    rubriek_nr: raw.rubriek_nr != null ? Number(raw.rubriek_nr) : void 0,
    length_m: raw.length_m != null && Number.isFinite(Number(raw.length_m)) ? Number(raw.length_m) : null
  };
}
function componentSealEnabled(analysis) {
  const s = readComponentSeal(analysis);
  return Boolean(s?.enabled);
}
function isLegacySealSibling(analysis) {
  return Boolean((analysis?.seal_for_subsection_id || "").toString().trim());
}
function sealCatalogLabel(analysis, fallback = "D02408") {
  const s = readComponentSeal(analysis);
  if (s?.enabled && (s.catalog_id || "").trim()) return String(s.catalog_id).trim();
  if (isLegacySealSibling(analysis) && (analysis?.catalog_id || "").trim()) {
    return String(analysis.catalog_id).trim();
  }
  return fallback;
}
function buildSealPayload(mat, lengthM, enabled = true) {
  return {
    enabled,
    material_id: mat.material_id,
    catalog_id: mat.catalog_id || void 0,
    material_name: mat.name || void 0,
    master_category: mat.master_category || void 0,
    category: mat.category || void 0,
    rubriek_nr: mat.rubriek_nr ?? 9,
    length_m: lengthM != null && Number.isFinite(lengthM) ? lengthM : null
  };
}
function clearSealPayload() {
  return { enabled: false };
}
function mergeAnalysisWithSeal(prev, seal) {
  const base = prev && typeof prev === "object" ? { ...prev } : {};
  delete base.seal_for_subsection_id;
  if (!seal || !seal.enabled) {
    delete base.seal;
    return base;
  }
  base.seal = { ...seal, enabled: true };
  return base;
}
function sealMaterialKeyFromSeal(seal) {
  if (!seal) return "";
  if ((seal.material_id || "").trim()) return `id:${String(seal.material_id).trim()}`;
  if ((seal.catalog_id || "").trim()) return `cat:${String(seal.catalog_id).trim().toUpperCase()}`;
  return "";
}

// lib/material-taxonomy.mjs
var MATERIAL_RUBRIEKEN = [
  { nr: 1, name: "Steenachtigen/beton/blokken" },
  { nr: 2, name: "Glas" },
  { nr: 3, name: "Dak-, vloer-, plafondconstructies" },
  { nr: 4, name: "Lichte paneelconstr./borstweringen/deuren" },
  { nr: 5, name: "Enkelvoudige plaatmaterialen/panelen" },
  { nr: 6, name: "Ventilatievoorzieningen" },
  { nr: 7, name: "Ventilatievoorzieningen oud (voor 1-1-2012)" },
  { nr: 8, name: "Lichte scheidingsconstructies" },
  { nr: 9, name: "Kier- en naaddichtingsprofielen" },
  { nr: 10, name: "Losse materialen" },
  { nr: 11, name: "Interieur" }
];
function rubriekByName(name) {
  const n = String(name || "").trim().toLowerCase();
  if (!n) return null;
  return MATERIAL_RUBRIEKEN.find((r) => r.name.toLowerCase() === n) || MATERIAL_RUBRIEKEN.find((r) => n.startsWith(r.name.toLowerCase().slice(0, 24))) || null;
}
function isLengthQuantityRubriek(nrOrName) {
  if (nrOrName == null || nrOrName === "") return false;
  if (typeof nrOrName === "number" && Number.isFinite(nrOrName)) {
    return Number(nrOrName) === 9;
  }
  const n = String(nrOrName).trim().toLowerCase();
  if (n === "9") return true;
  const rub = rubriekByName(n) || MATERIAL_RUBRIEKEN.find((r) => n.includes("kier"));
  return Boolean(rub && rub.nr === 9);
}

// src/room-discover.ts
function closePx(points) {
  if (!points.length) return [];
  const out = points.map((p) => ({ x: p.x, y: p.y }));
  const f = out[0];
  const l = out[out.length - 1];
  if (Math.hypot(f.x - l.x, f.y - l.y) > 1e-6) out.push({ ...f });
  return out;
}
function pointInRingLocal(pt, ring) {
  const closed = closePx(ring);
  const n = closed.length >= 2 && Math.hypot(closed[0].x - closed[closed.length - 1].x, closed[0].y - closed[closed.length - 1].y) < 1e-9 ? closed.length - 1 : closed.length;
  if (n < 3) return false;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = closed[i];
    const b = closed[j];
    const intersect = a.y > pt.y !== b.y > pt.y && pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y + 1e-30) + a.x;
    if (intersect) inside = !inside;
  }
  return inside;
}
function luminance(data, i) {
  return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
}
function toInkMap(img, sw, sh) {
  const { width: w, height: h, data } = img;
  const ink = new Uint8Array(sw * sh);
  const scaleX = w / sw;
  const scaleY = h / sh;
  let sum = 0;
  let n = 0;
  for (let y = 0; y < sh; y += 2) {
    for (let x = 0; x < sw; x += 2) {
      const sx = Math.min(w - 1, Math.floor(x * scaleX));
      const sy = Math.min(h - 1, Math.floor(y * scaleY));
      sum += luminance(data, (sy * w + sx) * 4);
      n++;
    }
  }
  const mean = n ? sum / n : 180;
  const thresh = Math.min(170, Math.max(90, mean * 0.72));
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const sx = Math.min(w - 1, Math.floor(x * scaleX));
      const sy = Math.min(h - 1, Math.floor(y * scaleY));
      ink[y * sw + x] = luminance(data, (sy * w + sx) * 4) < thresh ? 1 : 0;
    }
  }
  return ink;
}
function dilate(src, w, h) {
  const dst = new Uint8Array(src.length);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let v = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (src[(y + dy) * w + (x + dx)]) v = 1;
        }
      }
      dst[y * w + x] = v;
    }
  }
  return dst;
}
function erode(src, w, h) {
  const dst = new Uint8Array(src.length);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let v = 1;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!src[(y + dy) * w + (x + dx)]) v = 0;
        }
      }
      dst[y * w + x] = v;
    }
  }
  return dst;
}
function paperMask(ink, w, h) {
  const paper = new Uint8Array(w * h);
  for (let i = 0; i < ink.length; i++) paper[i] = ink[i] ? 0 : 1;
  return paper;
}
function removeBorderConnected(paper, w, h) {
  const out = paper.slice();
  const stack = [];
  const push = (x, y) => {
    const i = y * w + x;
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    if (!out[i]) return;
    out[i] = 0;
    stack.push(i);
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w;
    const y = i / w | 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  return out;
}
function labelBlobs(mask, w, h) {
  const labels = new Int32Array(w * h);
  const blobs = [];
  let next = 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i] || labels[i]) continue;
      const id = next++;
      const pixels = [];
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      const stack = [i];
      labels[i] = id;
      while (stack.length) {
        const cur = stack.pop();
        pixels.push(cur);
        const cx = cur % w;
        const cy = cur / w | 0;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        const neigh = [cur + 1, cur - 1, cur + w, cur - w];
        for (const n of neigh) {
          if (n < 0 || n >= labels.length) continue;
          if (!mask[n] || labels[n]) continue;
          const nx = n % w;
          const ny = n / w | 0;
          if (Math.abs(nx - cx) + Math.abs(ny - cy) !== 1) continue;
          labels[n] = id;
          stack.push(n);
        }
      }
      blobs.push({ id, pixels, minX, minY, maxX, maxY });
    }
  }
  return blobs;
}
function traceContour(mask, w, h, blob) {
  const set = new Set(blob.pixels);
  let start = -1;
  for (let y2 = blob.minY; y2 <= blob.maxY; y2++) {
    for (let x2 = blob.minX; x2 <= blob.maxX; x2++) {
      const i = y2 * w + x2;
      if (set.has(i)) {
        start = i;
        break;
      }
    }
    if (start >= 0) break;
  }
  if (start < 0) return null;
  const dirs = [
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1]
  ];
  const pts = [];
  let x = start % w;
  let y = start / w | 0;
  let dir = 0;
  const startX = x;
  const startY = y;
  let guard = 0;
  const maxSteps = blob.pixels.length * 8 + 100;
  do {
    pts.push({ x, y });
    let found = false;
    for (let k = 0; k < 8; k++) {
      const nd = (dir + 6 + k) % 8;
      const nx = x + dirs[nd][0];
      const ny = y + dirs[nd][1];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (!set.has(ny * w + nx)) continue;
      x = nx;
      y = ny;
      dir = nd;
      found = true;
      break;
    }
    if (!found) break;
    guard++;
  } while ((x !== startX || y !== startY) && guard < maxSteps);
  if (pts.length < 4) return null;
  return pts;
}
function blobToRingPixels(blob, w0, h0, sw, sh) {
  return closePx([
    { x: blob.minX / sw * w0, y: blob.minY / sh * h0 },
    { x: (blob.maxX + 1) / sw * w0, y: blob.minY / sh * h0 },
    { x: (blob.maxX + 1) / sw * w0, y: (blob.maxY + 1) / sh * h0 },
    { x: blob.minX / sw * w0, y: (blob.maxY + 1) / sh * h0 }
  ]);
}
function roomsFromPaperMask(paper, sw, sh, w0, h0) {
  const blobs = labelBlobs(paper, sw, sh);
  const total = sw * sh;
  const minPx = Math.max(40, total * 15e-4);
  const maxPx = total * 0.55;
  const rooms2 = [];
  for (const blob of blobs) {
    if (blob.pixels.length < minPx || blob.pixels.length > maxPx) continue;
    const bw = blob.maxX - blob.minX + 1;
    const bh = blob.maxY - blob.minY + 1;
    if (bw < 6 || bh < 6) continue;
    let ring = null;
    const contour = traceContour(paper, sw, sh, blob);
    if (contour && contour.length >= 4) {
      const mapped = contour.map((p) => ({
        x: p.x / sw * w0,
        y: p.y / sh * h0
      }));
      ring = closePx(rdpSimplify(mapped, Math.max(0.6, Math.min(w0, h0) * 15e-4)));
    }
    if (!ring || ring.length < 4) {
      ring = blobToRingPixels(blob, w0, h0, sw, sh);
    }
    const area = shoelaceArea(ring);
    if (area < minPx * (w0 / sw) * (h0 / sh) * 0.35) continue;
    rooms2.push({ points: ring, areaPx: area });
  }
  rooms2.sort((a, b) => b.areaPx - a.areaPx);
  return rooms2;
}
function discoverRoomPolylines(img) {
  const w0 = img.width;
  const h0 = img.height;
  if (w0 < 40 || h0 < 40) return [];
  const scale = Math.min(1, 560 / Math.max(w0, h0));
  const sw = Math.max(40, Math.floor(w0 * scale));
  const sh = Math.max(40, Math.floor(h0 * scale));
  let ink = toInkMap(img, sw, sh);
  ink = dilate(ink, sw, sh);
  ink = dilate(ink, sw, sh);
  ink = erode(ink, sw, sh);
  const paperFull = paperMask(ink, sw, sh);
  const paperInterior = removeBorderConnected(paperFull, sw, sh);
  let rooms2 = roomsFromPaperMask(paperInterior, sw, sh, w0, h0);
  if (rooms2.length < 2) {
    const alt = roomsFromPaperMask(paperFull, sw, sh, w0, h0).filter((r) => {
      const xs = r.points.map((p) => p.x);
      const ys = r.points.map((p) => p.y);
      const bw = Math.max(...xs) - Math.min(...xs);
      const bh = Math.max(...ys) - Math.min(...ys);
      return bw < w0 * 0.92 && bh < h0 * 0.92;
    });
    if (alt.length > rooms2.length) rooms2 = alt;
  }
  return rooms2.slice(0, 50);
}
function pixelsToSectionNorm(points, canvasW, canvasH) {
  return closeRing(
    points.map((p) => ({
      x: p.x / Math.max(1, canvasW),
      y: p.y / Math.max(1, canvasH)
    }))
  );
}
var LINE_REF_DIM = 640;
var RECT_FILL_MIN = 0.72;
function circularityOf(ring) {
  const a = shoelaceArea(ring);
  const p = polylinePerimeter(ring);
  if (a < 1e-6 || p < 1e-6) return 0;
  return Math.min(1.2, 4 * Math.PI * a / (p * p));
}
function suggestOpeningLabel(shape, index1) {
  if (shape === "circle") return `Rond kozijn ${index1}`;
  return `Kozijn ${index1}`;
}
function isContourAxisAligned(ring, angleTolDeg = 14) {
  const closed = closePx(ring);
  if (closed.length < 4) return false;
  let aligned = 0;
  let total = 0;
  for (let i = 0; i < closed.length - 1; i++) {
    const dx = closed[i + 1].x - closed[i].x;
    const dy = closed[i + 1].y - closed[i].y;
    const len = Math.hypot(dx, dy);
    if (len < 0.5) continue;
    total++;
    const angle = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);
    const mod90 = Math.min(angle % 90, 90 - angle % 90);
    if (mod90 <= angleTolDeg) aligned++;
  }
  return total >= 3 && aligned / total >= 0.72;
}
function classifyBlobShape(blob, ring) {
  const bw = blob.maxX - blob.minX + 1;
  const bh = blob.maxY - blob.minY + 1;
  const bboxArea = bw * bh;
  const fill = blob.pixels.length / Math.max(1, bboxArea);
  const aspect = Math.max(bw, bh) / Math.max(1, Math.min(bw, bh));
  if (aspect > 12) return null;
  if (fill < 0.32) return null;
  if (fill >= RECT_FILL_MIN && (fill >= 0.86 || isContourAxisAligned(ring))) return "rect";
  if (fill >= 0.55 && aspect <= 8) return "rect";
  return null;
}
function rasterizeOuterMask(outerPx, sw, sh, w0, h0) {
  const mask = new Uint8Array(sw * sh);
  const sx = sw / Math.max(1, w0);
  const sy = sh / Math.max(1, h0);
  const ring = outerPx.map((p) => ({ x: p.x * sx, y: p.y * sy }));
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      if (pointInRingLocal({ x: x + 0.5, y: y + 0.5 }, ring)) mask[y * sw + x] = 1;
    }
  }
  return mask;
}
function erodeMask(src, w, h, passes = 2) {
  let cur = src;
  for (let p = 0; p < passes; p++) {
    const dst = new Uint8Array(cur.length);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (!cur[i]) continue;
        let ok = 1;
        for (let dy = -1; dy <= 1 && ok; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!cur[(y + dy) * w + (x + dx)]) {
              ok = 0;
              break;
            }
          }
        }
        dst[i] = ok;
      }
    }
    cur = dst;
  }
  return cur;
}
function andMask(a, b) {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] && b[i] ? 1 : 0;
  return out;
}
function removePaperTouchingSearchBorder(paper, search, w, h) {
  const out = paper.slice();
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (!out[i]) return;
    out[i] = 0;
    stack.push(i);
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!out[i] || !search[i]) {
        out[i] = 0;
        continue;
      }
      let seed = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      if (!seed) {
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1]
        ]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h || !search[ny * w + nx]) {
            seed = true;
            break;
          }
        }
      }
      if (seed) push(x, y);
    }
  }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w;
    const y = i / w | 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  return out;
}
function ringCentroid(ring) {
  let x = 0;
  let y = 0;
  const n = Math.max(1, ring.length);
  for (const p of ring) {
    x += p.x;
    y += p.y;
  }
  return { x: x / n, y: y / n };
}
function openingsTooSimilar(a, b) {
  const ca = ringCentroid(a);
  const cb = ringCentroid(b);
  const aa = shoelaceArea(a);
  const ab = shoelaceArea(b);
  if (aa < 1 || ab < 1) return false;
  const dist = Math.hypot(ca.x - cb.x, ca.y - cb.y);
  const ra = Math.sqrt(aa / Math.PI);
  const rb = Math.sqrt(ab / Math.PI);
  if (dist > (ra + rb) * 0.35) return false;
  const ratio = Math.min(aa, ab) / Math.max(aa, ab);
  return ratio > 0.55;
}
function edgeInk(ink, w, h) {
  const out = new Uint8Array(ink.length);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!ink[i]) continue;
      if (!ink[i - 1] || !ink[i + 1] || !ink[i - w] || !ink[i + w]) out[i] = 1;
    }
  }
  return out;
}
function keepAxisAlignedInk(ink, w, h, minLen) {
  const out = new Uint8Array(ink.length);
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      if (!ink[y * w + x]) {
        x++;
        continue;
      }
      const start = x;
      while (x < w && ink[y * w + x]) x++;
      if (x - start >= minLen) {
        for (let xx = start; xx < x; xx++) out[y * w + xx] = 1;
      }
    }
  }
  for (let x = 0; x < w; x++) {
    let y = 0;
    while (y < h) {
      if (!ink[y * w + x]) {
        y++;
        continue;
      }
      const start = y;
      while (y < h && ink[y * w + x]) y++;
      if (y - start >= minLen) {
        for (let yy = start; yy < y; yy++) out[yy * w + x] = 1;
      }
    }
  }
  return out;
}
function openingKindScore(kind) {
  return kind === "line_rect" ? 3 : kind === "paper_pocket" ? 2 : 1;
}
function extractAxisSegs(mask, w, h, minLen) {
  const hSegs = [];
  const vSegs = [];
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      if (!mask[y * w + x]) {
        x++;
        continue;
      }
      const start = x;
      while (x < w && mask[y * w + x]) x++;
      if (x - start >= minLen) hSegs.push({ a: start, b: x - 1, c: y });
    }
  }
  for (let x = 0; x < w; x++) {
    let y = 0;
    while (y < h) {
      if (!mask[y * w + x]) {
        y++;
        continue;
      }
      const start = y;
      while (y < h && mask[y * w + x]) y++;
      if (y - start >= minLen) vSegs.push({ a: start, b: y - 1, c: x });
    }
  }
  return { h: hSegs, v: vSegs };
}
function clusterSegs(segs, bin) {
  const sorted = segs.slice().sort((a, b) => a.c - b.c || a.a - b.a);
  const clusters = [];
  for (const s of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(s.c - last.pos) <= bin) {
      last.segs.push(s);
      last.pos = (last.pos * (last.segs.length - 1) + s.c) / last.segs.length;
    } else {
      clusters.push({ pos: s.c, segs: [s] });
    }
  }
  return clusters;
}
function intervalCover(segs, from, to) {
  const span = to - from;
  if (span <= 1) return 0;
  const iv = [];
  for (const s of segs) {
    const a = Math.max(s.a, from);
    const b = Math.min(s.b, to);
    if (b > a) iv.push([a, b]);
  }
  if (!iv.length) return 0;
  iv.sort((p, q) => p[0] - q[0]);
  let covered = 0;
  let cs = iv[0][0];
  let ce = iv[0][1];
  for (let i = 1; i < iv.length; i++) {
    if (iv[i][0] <= ce + 1) ce = Math.max(ce, iv[i][1]);
    else {
      covered += ce - cs;
      cs = iv[i][0];
      ce = iv[i][1];
    }
  }
  covered += ce - cs;
  return covered / span;
}
function sideIsLocal(segs, from, to, minCover) {
  const sideLen = to - from;
  if (sideLen < 1) return false;
  let maxLen = 0;
  let maxOverlap = 0;
  for (const s of segs) {
    const ov = Math.min(s.b, to) - Math.max(s.a, from);
    if (ov <= 0) continue;
    if (ov > maxOverlap) maxOverlap = ov;
    if (ov > sideLen * 0.5) maxLen = Math.max(maxLen, s.b - s.a);
  }
  if (maxOverlap / sideLen < minCover) return false;
  if (maxLen > sideLen * 1.4) return false;
  return true;
}
function rectInkFraction(ink, w, x0, y0, x1, y1) {
  const ix0 = Math.ceil(x0) + 2;
  const iy0 = Math.ceil(y0) + 2;
  const ix1 = Math.floor(x1) - 2;
  const iy1 = Math.floor(y1) - 2;
  if (ix1 <= ix0 || iy1 <= iy0) return 1;
  let n = 0;
  let inkN = 0;
  for (let y = iy0; y <= iy1; y++) {
    for (let x = ix0; x <= ix1; x++) {
      n++;
      if (ink[y * w + x]) inkN++;
    }
  }
  return n ? inkN / n : 1;
}
function lineDetectParams(sw, sh) {
  const s = Math.min(sw, sh) / LINE_REF_DIM;
  return {
    minLen: Math.max(4, Math.round(8 * s)),
    minSide: Math.max(6, Math.round(10 * s)),
    clusterBin: Math.max(1, Math.round(2 * s)),
    minCover: 0.68,
    maxAspect: 8,
    maxInteriorInk: 0.28,
    nestTol: Math.max(2, Math.round(2 * s))
  };
}
function findClosedLineRects(ink, search, sw, sh, p = lineDetectParams(sw, sh)) {
  const edges = edgeInk(andMask(ink, search), sw, sh);
  const { h, v } = extractAxisSegs(edges, sw, sh, p.minLen);
  if (h.length < 2 || v.length < 2) return [];
  let bin = p.clusterBin;
  let hCl = clusterSegs(h, bin);
  let vCl = clusterSegs(v, bin);
  while ((hCl.length > 55 || vCl.length > 55) && bin < p.clusterBin + 3) {
    bin += 1;
    hCl = clusterSegs(h, bin);
    vCl = clusterSegs(v, bin);
  }
  if (hCl.length < 2 || vCl.length < 2) return [];
  const found = [];
  for (let i = 0; i < vCl.length; i++) {
    for (let j = i + 1; j < vCl.length; j++) {
      const x0 = Math.min(vCl[i].pos, vCl[j].pos);
      const x1 = Math.max(vCl[i].pos, vCl[j].pos);
      const width = x1 - x0;
      if (width < p.minSide) continue;
      const left = vCl[i].pos <= vCl[j].pos ? vCl[i] : vCl[j];
      const right = vCl[i].pos <= vCl[j].pos ? vCl[j] : vCl[i];
      for (let pIdx = 0; pIdx < hCl.length; pIdx++) {
        for (let q = pIdx + 1; q < hCl.length; q++) {
          const y0 = Math.min(hCl[pIdx].pos, hCl[q].pos);
          const y1 = Math.max(hCl[pIdx].pos, hCl[q].pos);
          const height = y1 - y0;
          if (height < p.minSide) continue;
          const aspect = Math.max(width, height) / Math.min(width, height);
          if (aspect > p.maxAspect) continue;
          const top = hCl[pIdx].pos <= hCl[q].pos ? hCl[pIdx] : hCl[q];
          const bot = hCl[pIdx].pos <= hCl[q].pos ? hCl[q] : hCl[pIdx];
          if (intervalCover(top.segs, x0, x1) < p.minCover) continue;
          if (intervalCover(bot.segs, x0, x1) < p.minCover) continue;
          if (intervalCover(left.segs, y0, y1) < p.minCover) continue;
          if (intervalCover(right.segs, y0, y1) < p.minCover) continue;
          if (!sideIsLocal(top.segs, x0, x1, p.minCover)) continue;
          if (!sideIsLocal(bot.segs, x0, x1, p.minCover)) continue;
          if (!sideIsLocal(left.segs, y0, y1, p.minCover)) continue;
          if (!sideIsLocal(right.segs, y0, y1, p.minCover)) continue;
          if (rectInkFraction(ink, sw, x0, y0, x1, y1) > p.maxInteriorInk) continue;
          found.push({ x0, y0, x1, y1, area: width * height });
        }
      }
    }
  }
  found.sort((a, b) => b.area - a.area);
  const kept = [];
  for (const r of found) {
    const nested = kept.some(
      (k) => r.x0 >= k.x0 - p.nestTol && r.y0 >= k.y0 - p.nestTol && r.x1 <= k.x1 + p.nestTol && r.y1 <= k.y1 + p.nestTol
    );
    if (nested) continue;
    const dup = kept.some((k) => {
      const ox0 = Math.max(k.x0, r.x0);
      const oy0 = Math.max(k.y0, r.y0);
      const ox1 = Math.min(k.x1, r.x1);
      const oy1 = Math.min(k.y1, r.y1);
      if (ox1 <= ox0 || oy1 <= oy0) return false;
      const inter = (ox1 - ox0) * (oy1 - oy0);
      return inter / Math.min(k.area, r.area) > 0.7;
    });
    if (dup) continue;
    kept.push(r);
  }
  return kept;
}
function lineRectToOpening(r, sw, sh, w0, h0) {
  const ring = closePx([
    { x: r.x0 / sw * w0, y: r.y0 / sh * h0 },
    { x: r.x1 / sw * w0, y: r.y0 / sh * h0 },
    { x: r.x1 / sw * w0, y: r.y1 / sh * h0 },
    { x: r.x0 / sw * w0, y: r.y1 / sh * h0 }
  ]);
  const area = shoelaceArea(ring);
  return {
    points: ring,
    areaPx: area,
    kind: "line_rect",
    shape: "rect",
    circularity: circularityOf(ring),
    suggestedLabel: suggestOpeningLabel("rect", 0)
  };
}
function blobToOpening(blob, mask, sw, sh, w0, h0, kind) {
  let probe = null;
  const contour = traceContour(mask, sw, sh, blob);
  if (contour && contour.length >= 4) {
    const mapped = contour.map((p) => ({
      x: p.x / sw * w0,
      y: p.y / sh * h0
    }));
    probe = closePx(rdpSimplify(mapped, Math.max(0.35, Math.min(w0, h0) * 9e-4)));
  }
  if (!probe || probe.length < 4) {
    probe = blobToRingPixels(blob, w0, h0, sw, sh);
  }
  const shape = classifyBlobShape(blob, probe);
  if (!shape) return null;
  const ring = blobToRingPixels(blob, w0, h0, sw, sh);
  const area = shoelaceArea(ring);
  if (area < 8) return null;
  const circ = circularityOf(ring);
  return {
    points: ring,
    areaPx: area,
    kind,
    shape,
    circularity: circ,
    suggestedLabel: suggestOpeningLabel(shape, 0)
  };
}
function discoverInteriorOpenings(img, outerNorm, opts) {
  const w0 = img.width;
  const h0 = img.height;
  if (w0 < 40 || h0 < 40 || !outerNorm || outerNorm.length < 3) return [];
  const outerPx = closePx(
    outerNorm.map((p) => ({
      x: p.x * w0,
      y: p.y * h0
    }))
  );
  const outerAreaPx = shoelaceArea(outerPx);
  if (outerAreaPx < 80) return [];
  const maxWorkDim = Math.max(64, Math.min(4096, opts?.maxWorkDim ?? 640));
  const maxLineWorkDim = Math.max(64, Math.min(4096, opts?.maxLineWorkDim ?? maxWorkDim));
  const scale = Math.min(1, maxWorkDim / Math.max(w0, h0));
  const sw = Math.max(40, Math.floor(w0 * scale));
  const sh = Math.max(40, Math.floor(h0 * scale));
  const lineScale = Math.min(1, maxLineWorkDim / Math.max(w0, h0));
  const lsw = Math.max(40, Math.floor(w0 * lineScale));
  const lsh = Math.max(40, Math.floor(h0 * lineScale));
  const outerMask = rasterizeOuterMask(outerPx, sw, sh, w0, h0);
  const search = erodeMask(outerMask, sw, sh, 2);
  const linePeel = Math.max(2, Math.round(2 * (Math.min(lsw, lsh) / LINE_REF_DIM)));
  const lineOuterMask = rasterizeOuterMask(outerPx, lsw, lsh, w0, h0);
  const lineSearch = erodeMask(lineOuterMask, lsw, lsh, linePeel);
  let searchCount = 0;
  for (let i = 0; i < search.length; i++) if (search[i]) searchCount++;
  if (searchCount < 40) return [];
  const inkRaw = toInkMap(img, sw, sh);
  const inkLineFull = lsw === sw && lsh === sh ? inkRaw : toInkMap(img, lsw, lsh);
  const lineParams = lineDetectParams(lsw, lsh);
  const inkLine = keepAxisAlignedInk(inkLineFull, lsw, lsh, lineParams.minLen);
  let inkMorph = dilate(inkRaw, sw, sh);
  inkMorph = erode(inkMorph, sw, sh);
  const dark = andMask(inkRaw, search);
  const paperFull = paperMask(inkMorph, sw, sh);
  const paperInSearch = andMask(paperFull, search);
  const paperCavities = removePaperTouchingSearchBorder(paperInSearch, search, sw, sh);
  const minPx = Math.max(8, Math.floor(searchCount * 2e-3));
  const maxPx = Math.floor(searchCount * 0.5);
  const minFrac = Math.max(0, Math.min(1, opts?.minAreaFraction ?? 0));
  const minAreaImg = minFrac <= 0 ? outerAreaPx * 2e-3 : outerAreaPx * minFrac;
  const maxAreaImg = outerAreaPx * 0.98;
  const raw = [];
  const pushBlobs = (mask, kind) => {
    for (const blob of labelBlobs(mask, sw, sh)) {
      if (blob.pixels.length < minPx || blob.pixels.length > maxPx) continue;
      const bw = blob.maxX - blob.minX + 1;
      const bh = blob.maxY - blob.minY + 1;
      if (bw < 4 || bh < 4) continue;
      const bboxArea = bw * bh;
      const fill = blob.pixels.length / Math.max(1, bboxArea);
      if (kind === "dark_fill" && fill < 0.35 && Math.max(bw, bh) / Math.min(bw, bh) > 4) continue;
      const opening = blobToOpening(blob, mask, sw, sh, w0, h0, kind);
      if (!opening) continue;
      if (opening.areaPx < minAreaImg || opening.areaPx > maxAreaImg) continue;
      const c = ringCentroid(opening.points);
      if (!pointInRingLocal(c, outerPx)) continue;
      raw.push(opening);
    }
  };
  pushBlobs(dark, "dark_fill");
  pushBlobs(paperCavities, "paper_pocket");
  for (const r of findClosedLineRects(inkLine, lineSearch, lsw, lsh)) {
    const opening = lineRectToOpening(r, lsw, lsh, w0, h0);
    if (opening.areaPx < minAreaImg || opening.areaPx > Math.min(maxAreaImg, outerAreaPx * 0.5)) continue;
    const c = ringCentroid(opening.points);
    if (!pointInRingLocal(c, outerPx)) continue;
    raw.push(opening);
  }
  raw.sort((a, b) => {
    const kd = openingKindScore(b.kind) - openingKindScore(a.kind);
    if (kd) return kd;
    return b.areaPx - a.areaPx;
  });
  const kept = [];
  for (const o of raw) {
    const dupIdx = kept.findIndex((k) => openingsTooSimilar(k.points, o.points));
    if (dupIdx >= 0) {
      if (openingKindScore(o.kind) > openingKindScore(kept[dupIdx].kind)) {
        kept[dupIdx] = o;
      }
      continue;
    }
    const c = ringCentroid(o.points);
    if (kept.some(
      (k) => k.areaPx > o.areaPx && o.areaPx < k.areaPx * 0.85 && pointInRingLocal(c, k.points)
    )) {
      continue;
    }
    kept.push(o);
  }
  kept.sort((a, b) => b.areaPx - a.areaPx);
  const result = kept.slice(0, 40).map((o, i) => ({
    ...o,
    suggestedLabel: suggestOpeningLabel(o.shape, i + 1)
  }));
  if (opts?.meta) {
    const kindCounts = {
      dark_fill: 0,
      paper_pocket: 0,
      line_rect: 0
    };
    for (const o of result) kindCounts[o.kind]++;
    opts.meta.inputW = w0;
    opts.meta.inputH = h0;
    opts.meta.workW = sw;
    opts.meta.workH = sh;
    opts.meta.lineWorkW = lsw;
    opts.meta.lineWorkH = lsh;
    opts.meta.kindCounts = kindCounts;
  }
  return result;
}

// src/floormap-helpers.ts
function partNoun(kind) {
  const k = String(kind || "FLOORMAP").toUpperCase();
  if (k === "FLOORMAP") {
    return { singular: "ruimte", plural: "ruimten", title: "Plattegrond", kindLabel: "Plattegrond" };
  }
  if (k === "FACADE") {
    return { singular: "component", plural: "componenten", title: "Gevel", kindLabel: "Gevel" };
  }
  if (k === "CROSS_SECTION") {
    return {
      singular: "component",
      plural: "componenten",
      title: "Dwarsdoorsnede",
      kindLabel: "Dwarsdoorsnede"
    };
  }
  if (k === "SECTION") {
    return {
      singular: "component",
      plural: "componenten",
      title: "Doorsnede",
      kindLabel: "Doorsnede"
    };
  }
  return { singular: "component", plural: "componenten", title: "Tekening", kindLabel: "Tekening" };
}
function levelLabel(hint) {
  switch (String(hint || "").toUpperCase()) {
    case "SOUTERRAIN":
      return "Souterrain";
    case "GROUND":
      return "Begane vloer";
    case "BEL_ETAGE":
      return "Bel-etage";
    case "FIRST":
      return "1e verdieping";
    case "SECOND":
      return "2e verdieping";
    case "THIRD":
      return "3e verdieping";
    case "ROOF":
      return "Zolder";
    case "OTHER":
      return "Overig";
    default:
      return hint || "Overig";
  }
}
function levelSortRank(hint) {
  switch (String(hint || "").toUpperCase()) {
    case "SOUTERRAIN":
      return 0;
    case "GROUND":
      return 1;
    case "BEL_ETAGE":
      return 2;
    case "FIRST":
      return 3;
    case "SECOND":
      return 4;
    case "THIRD":
      return 5;
    case "ROOF":
      return 6;
    case "OTHER":
      return 7;
    default:
      return 8;
  }
}
function inferLevelHintFromLabel(label) {
  const t = String(label || "").trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  if (!t) return null;
  if (/\bsouterrain\b/.test(t) || /\bkelder\b/.test(t)) return "SOUTERRAIN";
  if (/\b(begane|bg\.?|parterre|ground)\b/.test(t) || /\bb\.?\s*g\.?\b/.test(t)) return "GROUND";
  if (/\bbel[-\s]?etage\b/.test(t)) return "BEL_ETAGE";
  if (/\b(zolder|dak|attic|roof)\b/.test(t)) return "ROOF";
  if (/\b(3e|3de|derde)\b/.test(t) || /\bverdieping\s*3\b/.test(t)) return "THIRD";
  if (/\b(2e|2de|tweede)\b/.test(t) || /\bverdieping\s*2\b/.test(t)) return "SECOND";
  if (/\b(1e|1ste|eerste)\b/.test(t) || /\bverdieping\s*1\b/.test(t)) return "FIRST";
  if (/\bverdieping\b/.test(t)) return "FIRST";
  return null;
}
function normalizeOrientatieCode(raw) {
  return String(raw || "").trim().toUpperCase();
}
function normalizeVrNr(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}
function compareVrNr(a, b) {
  const na = /^\d+$/.test(a) ? Number(a) : NaN;
  const nb = /^\d+$/.test(b) ? Number(b) : NaN;
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return a.localeCompare(b, "nl", { numeric: true });
}
function collectAvailableVrNrs(items) {
  const set = /* @__PURE__ */ new Set();
  for (const r of items) {
    const vr = normalizeVrNr(r.vr_nr);
    if (vr) set.add(vr);
  }
  return [...set].sort(compareVrNr);
}
function roomMatchesVrFilter(room, filter) {
  if (!filter) return true;
  return normalizeVrNr(room.vr_nr) === filter;
}
function roomListCountLabel(filter, visible, total) {
  if (filter && visible !== total) return `${visible}/${total}`;
  return String(total);
}

// src/floormap-canvas.ts
function canvasToNorm(cx, cy, canvasWidth2, canvasHeight2) {
  return {
    x: Math.min(1, Math.max(0, cx / Math.max(1, canvasWidth2))),
    y: Math.min(1, Math.max(0, cy / Math.max(1, canvasHeight2)))
  };
}
function canvasToNormUnclamped(cx, cy, canvasWidth2, canvasHeight2) {
  return {
    x: cx / Math.max(1, canvasWidth2),
    y: cy / Math.max(1, canvasHeight2)
  };
}
function normToCanvas(p, canvasWidth2, canvasHeight2) {
  return { x: p.x * canvasWidth2, y: p.y * canvasHeight2 };
}
function eventToCanvas(ev, rect, canvasWidth2, canvasHeight2) {
  return {
    x: (ev.clientX - rect.left) / Math.max(1, rect.width) * canvasWidth2,
    y: (ev.clientY - rect.top) / Math.max(1, rect.height) * canvasHeight2
  };
}
function normalizeNormRect(a, b) {
  return {
    x0: Math.min(a.x, b.x),
    y0: Math.min(a.y, b.y),
    x1: Math.max(a.x, b.x),
    y1: Math.max(a.y, b.y)
  };
}
function normRectRing(r) {
  return [
    { x: r.x0, y: r.y0 },
    { x: r.x1, y: r.y0 },
    { x: r.x1, y: r.y1 },
    { x: r.x0, y: r.y1 }
  ];
}
function normRectSizeOk(r) {
  return r.x1 - r.x0 >= 8e-3 && r.y1 - r.y0 >= 8e-3;
}
function hitVertex(norm, points, canvasWidth2, canvasHeight2, pxRadius = 8) {
  const n = points.length > 1 && Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y) < 1e-6 ? points.length - 1 : points.length;
  let best = -1;
  let bestDist = Infinity;
  const w = Math.max(1, canvasWidth2);
  const h = Math.max(1, canvasHeight2);
  for (let i = 0; i < n; i++) {
    const dx = (points[i].x - norm.x) * w;
    const dy = (points[i].y - norm.y) * h;
    const d = Math.hypot(dx, dy);
    if (d <= pxRadius && d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}
function vertexHitRadiusPx(detailActive) {
  return detailActive ? 16 : 10;
}
function closeSnapRadiusPx(detailActive) {
  return detailActive ? 22 : 16;
}
function normDistancePx(a, b, canvasWidth2, canvasHeight2) {
  const w = Math.max(1, canvasWidth2);
  const h = Math.max(1, canvasHeight2);
  return Math.hypot((a.x - b.x) * w, (a.y - b.y) * h);
}
function canClosePolygonAtCursor(norm, points, canvasWidth2, canvasHeight2, detailActive) {
  if (points.length < 3) return false;
  return normDistancePx(norm, points[0], canvasWidth2, canvasHeight2) <= closeSnapRadiusPx(detailActive);
}
function vertexHandleRadiusPx(detailActive) {
  return detailActive ? 5 : 2;
}
function polylineHitRadiusPx(detailActive) {
  return detailActive ? 18 : 12;
}
function hitNearPolyline(norm, points, maxPx, canvasWidth2, canvasHeight2) {
  return hitPolylineEdge(norm, points, maxPx, canvasWidth2, canvasHeight2) != null;
}
function hitPolylineEdge(norm, points, maxPx, canvasWidth2, canvasHeight2) {
  if (points.length < 2) return null;
  const p = normToCanvas(norm, canvasWidth2, canvasHeight2);
  const max2 = maxPx * maxPx;
  const w = Math.max(1, canvasWidth2);
  const h = Math.max(1, canvasHeight2);
  let best = null;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const abx = (b.x - a.x) * w;
    const aby = (b.y - a.y) * h;
    const apx = p.x - a.x * w;
    const apy = p.y - a.y * h;
    const ab2 = abx * abx + aby * aby;
    const t = ab2 > 1e-12 ? Math.min(1, Math.max(0, (apx * abx + apy * aby) / ab2)) : 0;
    if (t < 0.08 || t > 0.92) continue;
    const qx = a.x + (b.x - a.x) * t;
    const qy = a.y + (b.y - a.y) * t;
    const dx = p.x - qx * w;
    const dy = p.y - qy * h;
    const d2 = dx * dx + dy * dy;
    if (d2 <= max2 && (!best || d2 < best.distPx * best.distPx)) {
      best = { segmentIndex: i, point: { x: qx, y: qy }, distPx: Math.sqrt(d2) };
    }
  }
  return best;
}
function pointInRing2(pt, points) {
  const n = points.length > 1 && Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y) < 1e-6 ? points.length - 1 : points.length;
  if (n < 3) return false;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;
    const intersect = yi > pt.y !== yj > pt.y && pt.x < (xj - xi) * (pt.y - yi) / (yj - yi + 1e-15) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// src/floormap-discovery.ts
function discoveredOpeningToSectionPoints(normPoints, shape, minVerticesForComplex = 16) {
  if (shape === "rect") return closeRing(normPoints);
  return ensureEditablePolyline(normPoints, minVerticesForComplex);
}
function discoverMinAreaFractionFromPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n / 100));
}
function buildDiscoveryLabel(partSingular, roomCount) {
  return `${partSingular.charAt(0).toUpperCase() + partSingular.slice(1)} ${roomCount + 1}`;
}
function resolveDiscoveryOuter(opts) {
  if (opts.isFloormapKind) return null;
  const { pendingRoom: pendingRoom2, rooms: rooms2, selectedSetIds: selectedSetIds2, closeRing: closeRing2, isLengthComponent, differenceSubject: differenceSubject2 } = opts;
  if (pendingRoom2?.editingId && pendingRoom2.closed && pendingRoom2.points.length >= 3) {
    const editing = rooms2.find((r) => r.id === pendingRoom2.editingId);
    if (editing) {
      return {
        ...editing,
        points: closeRing2(pendingRoom2.points.map((p) => ({ ...p })))
      };
    }
  }
  const selected = rooms2.filter((r) => selectedSetIds2.has(r.id) && !isLengthComponent(r));
  if (selected.length >= 1) return differenceSubject2(selected);
  return null;
}
function ringCentroidNorm(ring) {
  let x = 0;
  let y = 0;
  const n = Math.max(1, ring.length);
  for (const p of ring) {
    x += p.x;
    y += p.y;
  }
  return { x: x / n, y: y / n };
}
function openingOverlapsExisting(normRing, outerId, rooms2, shoelaceArea2, isLengthComponent) {
  const area = shoelaceArea2(normRing);
  if (area < 1e-10) return true;
  const ca = ringCentroidNorm(normRing);
  const ra = Math.sqrt(area / Math.PI);
  for (const r of rooms2) {
    if (r.id === outerId || isLengthComponent(r)) continue;
    const ar = shoelaceArea2(r.points);
    if (ar < 1e-10) continue;
    const cb = ringCentroidNorm(r.points);
    const rb = Math.sqrt(ar / Math.PI);
    const dist = Math.hypot(ca.x - cb.x, ca.y - cb.y);
    const ratio = Math.min(area, ar) / Math.max(area, ar);
    if (dist < (ra + rb) * 0.4 && ratio > 0.5) return true;
    if (ratio > 0.55 && (ringFullyContained(normRing, r.points) || ringFullyContained(r.points, normRing))) {
      return true;
    }
  }
  return false;
}

// lib/material-kind-labels.mjs
var MATERIAL_KIND_HOMOGENEOUS = "homogeneous";
var MATERIAL_KIND_COMPOSITE = "composite_stack";
function normalizeMaterialKind(kind) {
  return kind === MATERIAL_KIND_COMPOSITE ? MATERIAL_KIND_COMPOSITE : MATERIAL_KIND_HOMOGENEOUS;
}
function materialKindInline(kind) {
  return normalizeMaterialKind(kind) === MATERIAL_KIND_COMPOSITE ? "samengesteld" : "enkellaags";
}

// src/auth-store.ts
function loadAuth(storageKey) {
  try {
    const raw = sessionStorage.getItem(storageKey) ?? localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token) return null;
    if (!sessionStorage.getItem(storageKey) && localStorage.getItem(storageKey)) {
      sessionStorage.setItem(storageKey, raw);
      localStorage.removeItem(storageKey);
    }
    return parsed;
  } catch {
    return null;
  }
}
function storeAuth(storageKey, info) {
  localStorage.removeItem(storageKey);
  if (!info) sessionStorage.removeItem(storageKey);
  else sessionStorage.setItem(storageKey, JSON.stringify(info));
}
async function syncSessionCookie(token) {
  try {
    if (token) {
      await fetch("/api/session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
    } else {
      await fetch("/api/session", {
        method: "DELETE",
        credentials: "include"
      });
    }
  } catch {
  }
}
function apiAuthHeaders(token, json = false) {
  const h = {
    Authorization: `Bearer ${token}`
  };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

// src/ws-url.ts
function resolveBppWsUrl() {
  if (location.protocol === "https:") {
    return `wss://${location.host}/ws`;
  }
  const q = new URLSearchParams(location.search).get("ws");
  const override = window.BPP_WS_URL;
  return q || override || `ws://${location.hostname}:18080/ws`;
}

// src/password-toggle.ts
var EYE_CLOSED = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75C21.27 9.11 17 5 12 5c-1.4 0-2.73.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78 3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/></svg>`;
var EYE_OPEN = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 5c-5 0-9.27 3.11-11 7.5C2.73 16.89 7 20 12 20s9.27-3.11 11-7.5C21.27 8.11 17 5 12 5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`;
function enhancePasswordInput(input) {
  if (input.dataset.pwToggle === "1") return;
  if (input.closest(".pw-field")) return;
  input.dataset.pwToggle = "1";
  const wrap = document.createElement("div");
  wrap.className = "pw-field";
  input.parentNode?.insertBefore(wrap, input);
  wrap.appendChild(input);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "pw-toggle";
  btn.setAttribute("aria-label", "Wachtwoord tonen");
  btn.setAttribute("aria-pressed", "false");
  btn.innerHTML = EYE_CLOSED;
  wrap.appendChild(btn);
  btn.addEventListener("click", () => {
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.innerHTML = show ? EYE_OPEN : EYE_CLOSED;
    btn.setAttribute("aria-pressed", show ? "true" : "false");
    btn.setAttribute("aria-label", show ? "Wachtwoord verbergen" : "Wachtwoord tonen");
  });
}
function initPasswordToggles(root = document) {
  root.querySelectorAll('input[type="password"]').forEach(enhancePasswordInput);
}

// src/app-version.ts
var APP_VERSION = "0.72";
var APP_NAME = "Stilte advies en meten";
var USER_DOCS_HREF = "/handleiding.html";

// src/project-menu.ts
var RECENT_KEY = "app-gevelwering-recent-projects";
var RECENT_MAX = 8;
function parseJsonOk(raw) {
  if (raw.startsWith("ERROR")) throw new Error(raw);
  return JSON.parse(raw);
}
function projectTitle(meta) {
  const label = (meta.label || "").trim();
  const ref = (meta.external_ref || "").trim();
  if (label && ref) return `${label} (${ref})`;
  if (label) return label;
  if (ref) return ref;
  const id = meta.building_id || "";
  return id ? `${id.slice(0, 8)}\u2026` : "Geen project";
}
function loadRecentProjects() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((p) => p?.building_id) : [];
  } catch {
    return [];
  }
}
function rememberRecentProject(entry) {
  const id = entry.building_id.trim();
  if (!id) return;
  const next = {
    building_id: id,
    label: (entry.label || "").trim(),
    external_ref: (entry.external_ref || "").trim() || void 0,
    at: Date.now()
  };
  const rest = loadRecentProjects().filter((p) => p.building_id !== id);
  localStorage.setItem(RECENT_KEY, JSON.stringify([next, ...rest].slice(0, RECENT_MAX)));
}
function removeRecentProject(buildingId2) {
  const id = buildingId2.trim();
  if (!id) return;
  localStorage.setItem(
    RECENT_KEY,
    JSON.stringify(loadRecentProjects().filter((p) => p.building_id !== id))
  );
}
async function cleanupProjectFolder(buildingId2, headers) {
  try {
    await fetch("/api/reports/cleanup-project-folder", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ building_id: buildingId2 })
    });
  } catch {
  }
}
function mountProjectMenu(root, host) {
  root.classList.add("file-menu");
  root.setAttribute("aria-label", "Bestand en Over");
  root.innerHTML = `
    <div class="file-menu-bar">
      <details class="file-menu-details" id="pm-root">
        <summary class="file-menu-summary">Bestand</summary>
        <ul class="file-menu-list" role="menu">
          <li><button type="button" role="menuitem" data-act="open">Openen\u2026</button></li>
          <li class="file-menu-recent-wrap">
            <details class="file-menu-recent">
              <summary>Recent geopend</summary>
              <ul class="file-menu-recent-list" id="pm-recent"></ul>
            </details>
          </li>
          <li><button type="button" role="menuitem" data-act="save">Project opslaan</button></li>
          <li><button type="button" role="menuitem" data-act="rename">Hernoemen\u2026</button></li>
          <li><button type="button" role="menuitem" data-act="delete" class="danger">Verwijderen\u2026</button></li>
        </ul>
      </details>
      <details class="file-menu-details" id="pm-about">
        <summary class="file-menu-summary">Over</summary>
        <ul class="file-menu-list" role="menu">
          <li class="file-menu-about-version" role="menuitem">${APP_NAME}</li>
          <li class="file-menu-about-version" role="menuitem">Versie ${APP_VERSION}</li>
          <li>
            <a class="file-menu-about-link" href="${USER_DOCS_HREF}" role="menuitem">Gebruikershandleiding</a>
          </li>
        </ul>
      </details>
      <span class="file-menu-project-title" id="pm-title" aria-live="polite">Geen project</span>
    </div>
    <dialog class="file-menu-dialog" id="pm-open-dialog">
      <form method="dialog" class="file-menu-dialog-form">
        <h2>Project openen</h2>
        <p class="hint">Kies een lopend project om verder te werken.</p>
        <ul class="file-menu-project-list" id="pm-open-list"></ul>
        <p class="hint hidden" id="pm-open-empty">Geen openstaande projecten.</p>
        <div class="actions">
          <button type="submit" value="cancel" class="secondary">Annuleren</button>
        </div>
      </form>
    </dialog>
  `;
  const detailsEl = root.querySelector("#pm-root");
  const aboutEl = root.querySelector("#pm-about");
  const titleEl = root.querySelector("#pm-title");
  const recentEl = root.querySelector("#pm-recent");
  const dialogEl = root.querySelector("#pm-open-dialog");
  const openListEl = root.querySelector("#pm-open-list");
  const openEmptyEl = root.querySelector("#pm-open-empty");
  function status(state, text) {
    host.onStatus?.(state, text);
  }
  function refreshTitle() {
    const id = host.getBuildingId();
    const meta = host.getProjectMeta();
    const title = projectTitle({ ...meta, building_id: id });
    titleEl.textContent = id ? title : "Geen project";
    host.setTitle?.(id ? title : "Geen project");
  }
  function rememberCurrent() {
    const id = host.getBuildingId();
    if (!id) return;
    const meta = host.getProjectMeta();
    rememberRecentProject({
      building_id: id,
      label: meta.label,
      external_ref: meta.external_ref
    });
    renderRecent();
    refreshTitle();
  }
  function closeMenu() {
    detailsEl.open = false;
    aboutEl.open = false;
    const recent = root.querySelector(".file-menu-recent");
    if (recent) recent.open = false;
  }
  function renderRecent() {
    recentEl.innerHTML = "";
    const items = loadRecentProjects();
    if (!items.length) {
      const li = document.createElement("li");
      li.className = "hint";
      li.textContent = "Nog geen recente projecten";
      recentEl.appendChild(li);
      return;
    }
    for (const p of items) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = projectTitle(p);
      btn.addEventListener("click", () => {
        closeMenu();
        void openProject(p.building_id);
      });
      li.appendChild(btn);
      recentEl.appendChild(li);
    }
  }
  async function openProject(buildingId2) {
    status("busy", "Project openen\u2026");
    try {
      await host.openBuilding(buildingId2);
      rememberCurrent();
      status("ok", "Project geopend");
    } catch (err) {
      status("err", err instanceof Error ? err.message : String(err));
    }
  }
  async function showOpenDialog() {
    const token = host.getToken();
    if (!token) {
      status("err", "Log eerst in");
      return;
    }
    closeMenu();
    openListEl.innerHTML = "";
    openEmptyEl.classList.add("hidden");
    status("busy", "Projecten laden\u2026");
    try {
      const ret = await host.invokeString("API_EngineerListProjects", [token]);
      const data = parseJsonOk(ret);
      const projects = data.projects || [];
      if (!projects.length) {
        openEmptyEl.classList.remove("hidden");
      }
      for (const p of projects) {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        const title = projectTitle(p);
        btn.textContent = p.customer_name ? `${title} \u2014 ${p.customer_name}` : title;
        if (p.project_status) {
          btn.title = p.project_status;
        }
        btn.addEventListener("click", () => {
          dialogEl.close();
          void openProject(p.building_id);
        });
        li.appendChild(btn);
        openListEl.appendChild(li);
      }
      status("ok", `${projects.length} project(en)`);
      if (typeof dialogEl.showModal === "function") dialogEl.showModal();
      else dialogEl.setAttribute("open", "");
    } catch (err) {
      status("err", err instanceof Error ? err.message : String(err));
    }
  }
  async function saveProject() {
    closeMenu();
    if (!host.getBuildingId()) {
      status("err", "Geen project geselecteerd");
      return;
    }
    status("busy", "Project opslaan\u2026");
    try {
      await host.saveProject();
      rememberCurrent();
      status("ok", "Project opgeslagen");
    } catch (err) {
      status("err", err instanceof Error ? err.message : String(err));
    }
  }
  async function renameProject() {
    closeMenu();
    const token = host.getToken();
    const id = host.getBuildingId();
    if (!token || !id) {
      status("err", "Geen project geselecteerd");
      return;
    }
    const meta = host.getProjectMeta();
    const label = window.prompt("Projectnaam (label)", meta.label || "");
    if (label === null) return;
    const externalRef = window.prompt("Projectnummer / werknummer", meta.external_ref || "");
    if (externalRef === null) return;
    status("busy", "Hernoemen\u2026");
    try {
      const ret = await host.invokeString("API_RenameProject", [
        token,
        id,
        label.trim(),
        externalRef.trim()
      ]);
      const data = parseJsonOk(ret);
      const next = {
        label: data.label ?? label.trim(),
        external_ref: data.external_ref ?? externalRef.trim()
      };
      host.onProjectRenamed?.(next);
      rememberRecentProject({ building_id: id, ...next });
      renderRecent();
      refreshTitle();
      status("ok", "Project hernoemd");
    } catch (err) {
      status("err", err instanceof Error ? err.message : String(err));
    }
  }
  async function deleteProject() {
    closeMenu();
    const token = host.getToken();
    const id = host.getBuildingId();
    if (!token || !id) {
      status("err", "Geen project geselecteerd");
      return;
    }
    const title = projectTitle({ ...host.getProjectMeta(), building_id: id });
    if (!window.confirm(
      `Project \xAB${title}\xBB definitief verwijderen?
Dit wist berekeningen, tekeningen en rapportmappen. Dit kan niet ongedaan worden gemaakt.`
    )) {
      return;
    }
    status("busy", "Project verwijderen\u2026");
    try {
      const ret = await host.invokeString("API_EngineerDeleteProject", [token, id]);
      parseJsonOk(ret);
      await cleanupProjectFolder(id, host.apiAuthHeaders());
      removeRecentProject(id);
      renderRecent();
      await host.onProjectDeleted?.();
      refreshTitle();
      status("ok", "Project verwijderd");
    } catch (err) {
      status("err", err instanceof Error ? err.message : String(err));
    }
  }
  detailsEl.addEventListener("toggle", () => {
    if (detailsEl.open) aboutEl.open = false;
  });
  aboutEl.addEventListener("toggle", () => {
    if (aboutEl.open) detailsEl.open = false;
  });
  root.addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-act]");
    if (!btn || !root.contains(btn)) return;
    const act = btn.dataset.act;
    if (act === "open") void showOpenDialog();
    else if (act === "save") void saveProject();
    else if (act === "rename") void renameProject();
    else if (act === "delete") void deleteProject();
  });
  document.addEventListener("click", (ev) => {
    if (!detailsEl.open && !aboutEl.open) return;
    if (root.contains(ev.target)) return;
    closeMenu();
  });
  renderRecent();
  refreshTitle();
  return {
    refreshTitle,
    rememberCurrent,
    setEnabled(on) {
      root.classList.toggle("disabled", !on);
      for (const b of root.querySelectorAll("button, summary")) {
        if (b instanceof HTMLElement) {
          if (on) b.removeAttribute("aria-disabled");
          else b.setAttribute("aria-disabled", "true");
        }
      }
    }
  };
}

// src/shared/bpp-session.ts
var BppSession = class {
  constructor(opts) {
    __publicField(this, "ws", null);
    __publicField(this, "sessionId", null);
    __publicField(this, "auth", null);
    __publicField(this, "reqCounter", 0);
    __publicField(this, "pending", /* @__PURE__ */ new Map());
    __publicField(this, "wsUrl");
    __publicField(this, "authKey");
    __publicField(this, "clientName");
    __publicField(this, "cb");
    /** Bumps on each connect() so stale open/close handlers are ignored. */
    __publicField(this, "connectGen", 0);
    __publicField(this, "reconnectTimer", null);
    /** Resolvers waiting for WebSocket OPEN (login while still connecting). */
    __publicField(this, "openWaiters", []);
    this.wsUrl = opts.wsUrl;
    this.authKey = opts.authKey;
    this.clientName = opts.clientName;
    this.cb = opts.callbacks;
  }
  nextRequestId(prefix) {
    this.reqCounter += 1;
    return `${prefix}_${this.reqCounter}_${Date.now()}`;
  }
  rejectAllPending(err) {
    for (const [id, waiter] of this.pending) {
      this.pending.delete(id);
      waiter.reject(err);
    }
  }
  rejectOpenWaiters(err) {
    const waiters = this.openWaiters.splice(0);
    for (const w of waiters) {
      clearTimeout(w.timer);
      w.reject(err);
    }
  }
  resolveOpenWaiters() {
    const waiters = this.openWaiters.splice(0);
    for (const w of waiters) {
      clearTimeout(w.timer);
      w.resolve();
    }
  }
  /** Wait until WS is OPEN (or fail). Used when user acts while still connecting. */
  async whenOpen(timeoutMs = 12e3) {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) {
      throw new Error(`WebSocket niet verbonden (${this.wsUrl}). Herlaad of start ./start.sh.`);
    }
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.openWaiters.findIndex((w) => w.timer === timer);
        if (idx >= 0) this.openWaiters.splice(idx, 1);
        reject(new Error(`WebSocket timeout \u2014 geen verbinding met ${this.wsUrl}`));
      }, timeoutMs);
      this.openWaiters.push({ resolve, reject, timer });
    });
  }
  async send(type, payload, wantType) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      if (this.ws?.readyState === WebSocket.CONNECTING) {
        await this.whenOpen();
      } else {
        throw new Error(`WebSocket niet open (${this.wsUrl}). Herlaad of start ./start.sh.`);
      }
    }
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`WebSocket niet open (${this.wsUrl}). Herlaad of start ./start.sh.`);
    }
    const request_id = this.nextRequestId(type.replace(".", "_"));
    const env = { v: 1, type, request_id, payload };
    if (this.sessionId && type !== "session.open") env.session_id = this.sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(request_id, { resolve, reject, want: wantType });
      this.ws.send(JSON.stringify(env));
    });
  }
  onMessage(raw) {
    let env;
    try {
      env = JSON.parse(raw);
    } catch {
      return;
    }
    if (env.type === "session.opened") {
      const sid = typeof env.session_id === "string" && env.session_id || (typeof env.payload?.session_id === "string" ? env.payload.session_id : null);
      if (sid) this.sessionId = sid;
    }
    if (env.type === "error") {
      const waiter2 = this.pending.get(env.request_id);
      if (waiter2) {
        this.pending.delete(env.request_id);
        waiter2.reject(new Error(JSON.stringify(env.payload ?? env)));
      }
      return;
    }
    const waiter = this.pending.get(env.request_id);
    if (!waiter) return;
    if (env.type === waiter.want || env.type.endsWith(".completed") || env.type === "exec.completed") {
      if (env.type === "invoke.accepted" || env.type === "exec.accepted") return;
      this.pending.delete(env.request_id);
      waiter.resolve(env);
    }
  }
  async invokeString(target, args) {
    const inv = await this.send("invoke.request", { target_kind: "procedure", target, args }, "invoke.completed");
    const ret = inv.payload?.return;
    if (typeof ret !== "string") throw new Error(`Onverwacht antwoord van ${target}`);
    return ret;
  }
  async loadSharedApi() {
    await this.send(
      "exec.request",
      { code: 'INCLUDE "fixtures/app-gevelwering/shared_building_api.basicpp"\n' },
      "exec.completed"
    );
    const bootRet = await this.invokeString("API_Bootstrap", []);
    if (!bootRet.startsWith("OK")) throw new Error(`API_Bootstrap mislukt: ${bootRet}`);
  }
  async bootstrapAndLogin(username, password) {
    await this.whenOpen();
    await this.loadSharedApi();
    const ret = await this.invokeString("API_Login", [username, password]);
    if (ret.startsWith("ERROR")) throw new Error(ret);
    const parsed = JSON.parse(ret);
    if (!parsed.ok || !parsed.token) throw new Error("Inloggen mislukt");
    const info = {
      token: parsed.token,
      username: parsed.username || username,
      display_name: parsed.display_name || username
    };
    this.auth = info;
    this.storeAuth(info);
    this.cb.onLogin(info);
    return info;
  }
  storeAuth(info) {
    storeAuth(this.authKey, info);
    void syncSessionCookie(info?.token ?? null);
  }
  loadStoredAuth() {
    return loadAuth(this.authKey);
  }
  logout() {
    this.auth = null;
    this.storeAuth(null);
    this.cb.onLogout();
  }
  /**
   * Open WS, session.open, loadSharedApi, validate stored token.
   * Page-specific `onReady` callback fires after successful restore or login prompt.
   */
  connect(opts) {
    const reconnectMs = opts?.reconnectMs ?? 1500;
    if (this.reconnectTimer != null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const gen = ++this.connectGen;
    this.sessionId = null;
    this.rejectAllPending(new Error("WebSocket herverbindt"));
    this.rejectOpenWaiters(new Error("WebSocket herverbindt"));
    const prev = this.ws;
    this.ws = null;
    if (prev && (prev.readyState === WebSocket.OPEN || prev.readyState === WebSocket.CONNECTING)) {
      try {
        prev.close();
      } catch {
      }
    }
    this.cb.onStatus(`Verbinden met ${this.wsUrl}\u2026`, "busy");
    this.cb.onConnLed(false);
    const ws = new WebSocket(this.wsUrl);
    this.ws = ws;
    ws.addEventListener("open", () => {
      if (gen !== this.connectGen || this.ws !== ws) return;
      this.cb.onConnLed(true);
      this.resolveOpenWaiters();
      void (async () => {
        try {
          await this.send("session.open", { client: this.clientName }, "session.opened");
          if (gen !== this.connectGen) return;
          await this.loadSharedApi();
          if (gen !== this.connectGen) return;
          const stored = this.loadStoredAuth();
          if (stored?.token) {
            const ret = await this.invokeString("API_ValidateSession", [stored.token]);
            if (gen !== this.connectGen) return;
            if (ret.startsWith("ERROR")) {
              this.cb.onLogout();
              this.cb.onStatus("Sessie verlopen \u2014 log in", "err");
            } else {
              this.auth = stored;
              this.cb.onLogin(stored);
              this.cb.onStatus("Gereed", "ok");
            }
          } else {
            this.cb.onLogout();
            this.cb.onStatus("Verbonden \u2014 log in", "ok");
          }
          if (gen !== this.connectGen) return;
          await this.cb.onReady?.();
        } catch (err) {
          if (gen !== this.connectGen) return;
          this.cb.onStatus(err instanceof Error ? err.message : String(err), "err");
          this.cb.onLogout();
        }
      })();
    });
    ws.addEventListener("message", (ev) => {
      if (this.ws !== ws) return;
      this.onMessage(String(ev.data));
    });
    ws.addEventListener("close", () => {
      if (gen !== this.connectGen) return;
      if (this.ws === ws) this.ws = null;
      this.sessionId = null;
      this.rejectAllPending(new Error("WebSocket verbroken"));
      this.rejectOpenWaiters(new Error("WebSocket verbroken"));
      this.cb.onConnLed(false);
      this.cb.onStatus(
        reconnectMs > 0 ? `Verbinding verbroken \u2014 opnieuw verbinden\u2026 (${this.wsUrl})` : `Verbinding verbroken (${this.wsUrl})`,
        "err"
      );
      if (reconnectMs > 0) {
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          if (gen === this.connectGen) this.connect(opts);
        }, reconnectMs);
      }
    });
    ws.addEventListener("error", () => {
      if (gen !== this.connectGen || this.ws !== ws) return;
      this.cb.onStatus(`WebSocket-fout (${this.wsUrl})`, "err");
    });
  }
};

// src/bpp-api.ts
function parseBppJson(ret) {
  if (ret.startsWith("ERROR")) throw new Error(ret);
  try {
    return JSON.parse(ret);
  } catch {
    throw new Error(`Ongeldig JSON-antwoord van bppServer: ${ret.slice(0, 240)}`);
  }
}
function bppScaleRatioArg(ratio) {
  if (ratio == null || !Number.isFinite(ratio)) return "NULL";
  return String(ratio);
}
function bppAspectArg(aspect) {
  if (aspect == null || !Number.isFinite(aspect) || aspect <= 0) return "NULL";
  return String(aspect);
}
async function bppListFloormapSections(invoke, token, buildingId2) {
  const ret = await invoke("API_ListFloormapSections", [token, buildingId2]);
  const data = parseBppJson(ret);
  return { sections: data.sections || [] };
}
async function bppSaveFloormapScale(invoke, token, opts) {
  const ret = await invoke("API_SaveFloormapScale", [
    token,
    opts.section_id,
    String(opts.metres_per_norm_unit),
    bppScaleRatioArg(opts.scale_ratio),
    opts.scale_source || "CALIBRATED",
    bppAspectArg(opts.scale_aspect_yx)
  ]);
  return parseBppJson(ret);
}
function bppPhase1Enabled() {
  try {
    return localStorage.getItem("GEVELWERING_BPP_HTTP") !== "1";
  } catch {
    return true;
  }
}
async function bppListDrawingSubsections(invoke, token, sectionId) {
  const ret = await invoke("API_ListDrawingSubsections", [token, sectionId]);
  const data = parseBppJson(ret);
  return { subsections: data.subsections || [] };
}
async function bppGetFloormapSection(invoke, token, sectionId) {
  const ret = await invoke("API_GetFloormapSection", [token, sectionId]);
  const data = parseBppJson(ret);
  if (!data.section?.id) throw new Error("scalable section not found");
  return { section: data.section };
}
async function bppSaveDrawingSubsection(invoke, token, body) {
  const ret = await invoke("API_SaveDrawingSubsection", [token, JSON.stringify(body)]);
  const data = parseBppJson(ret);
  if (!data.subsection_id) throw new Error("save subsection: geen subsection_id");
  return data;
}
async function bppDeleteDrawingSubsection(invoke, token, subsectionId) {
  const ret = await invoke("API_DeleteDrawingSubsection", [token, subsectionId]);
  const data = parseBppJson(ret);
  if (data.ok === false) {
    throw new Error(data.error || "Verwijderen mislukt");
  }
}
async function bppReorderDrawingSubsections(invoke, token, sectionId, orderedIds) {
  const ret = await invoke("API_ReorderDrawingSubsections", [
    token,
    sectionId,
    orderedIds.join(",")
  ]);
  parseBppJson(ret);
}
async function bppListMaterialCategories(invoke, token) {
  const ret = await invoke("API_ListMaterialCategories", [token]);
  const data = parseBppJson(ret);
  return { categories: data.categories || [] };
}
async function bppListMaterials(invoke, token, opts) {
  const ret = await invoke("API_ListMaterials", [
    token,
    opts.master_category || "",
    opts.category || "",
    opts.q || "",
    String(opts.limit ?? 800)
  ]);
  const data = parseBppJson(ret);
  return {
    materials: data.materials || [],
    master_category: data.master_category,
    rubriek_nr: data.rubriek_nr
  };
}
async function bppSaveSubsectionMaterial(invoke, token, subsectionId, materialId) {
  const ret = await invoke("API_SaveSubsectionMaterial", [token, subsectionId, materialId]);
  return parseBppJson(ret);
}
async function bppListMaterialFavorites(invoke, token, buildingId2) {
  const ret = await invoke("API_ListMaterialFavorites", [token, buildingId2]);
  const data = parseBppJson(ret);
  return { materials: data.materials || [] };
}
async function bppAddMaterialFavorite(invoke, token, buildingId2, materialId) {
  const ret = await invoke("API_AddMaterialFavorite", [token, buildingId2, materialId]);
  parseBppJson(ret);
}
async function bppRemoveMaterialFavorite(invoke, token, buildingId2, materialId) {
  const ret = await invoke("API_RemoveMaterialFavorite", [token, buildingId2, materialId]);
  parseBppJson(ret);
}
async function bppListMaterialFavoritePresets(invoke, token) {
  const ret = await invoke("API_ListMaterialFavoritePresets", [token]);
  const data = parseBppJson(ret);
  return { presets: data.presets || [] };
}
async function bppMaterialFavoritePresetAction(invoke, token, body) {
  const ret = await invoke("API_MaterialFavoritePresetAction", [token, JSON.stringify(body)]);
  return parseBppJson(ret);
}

// src/floormap.ts
var params = new URLSearchParams(location.search);
var BPP_WS = resolveBppWsUrl();
var AUTH_KEY = "app_gevelwering_engineer_auth";
var URL_BUILDING = params.get("building_id") || "";
var COMPONENT_DRAFT_KEY = "app-gevelwering-fm-component-draft";
var FM_LAST_SECTION_PREFIX = "app-gevelwering-fm-last-section:";
function urlSectionId() {
  return new URLSearchParams(location.search).get("section_id")?.trim() || "";
}
function lastSectionStorageKey(bid) {
  return `${FM_LAST_SECTION_PREFIX}${bid.trim().toLowerCase()}`;
}
function readLastSectionId(bid) {
  if (!bid) return "";
  try {
    return sessionStorage.getItem(lastSectionStorageKey(bid))?.trim() || "";
  } catch {
    return "";
  }
}
function persistLastSectionId(bid, sectionId) {
  if (!bid || !sectionId) return;
  try {
    sessionStorage.setItem(lastSectionStorageKey(bid), sectionId);
  } catch {
  }
}
function clearLastSectionId(bid) {
  if (!bid) return;
  try {
    sessionStorage.removeItem(lastSectionStorageKey(bid));
  } catch {
  }
}
function syncFloormapLocation(sectionId) {
  const url = new URL(location.href);
  if (buildingId) url.searchParams.set("building_id", buildingId);
  else url.searchParams.delete("building_id");
  if (sectionId) url.searchParams.set("section_id", sectionId);
  else url.searchParams.delete("section_id");
  history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}
function resolveSectionToOpen(bid) {
  const fromUrl = urlSectionId();
  if (fromUrl) return fromUrl;
  return readLastSectionId(bid);
}
var MATERIAL_PICK_KEY = "app-gevelwering-material-pick";
var connBarEl = document.getElementById("fm-conn-bar");
var connLedEl = document.getElementById("fm-conn-led");
var connStatusEl = document.getElementById("fm-conn-status");
var loginPanelEl = document.getElementById("fm-login-panel");
var loginForm = document.getElementById("fm-login-form");
var panelEl = document.getElementById("fm-panel");
var userLabelEl = document.getElementById("fm-user-label");
var logoutBtn = document.getElementById("fm-logout-btn");
var buildingInput = document.getElementById("fm-building-input");
var loadBuildingBtn = document.getElementById("fm-load-building-btn");
var sectionListEl = document.getElementById("fm-section-list");
var pickerPanelEl = document.getElementById("fm-picker-panel");
var workspacePanelEl = document.getElementById("fm-workspace-panel");
var sectionTitleEl = document.getElementById("fm-section-title");
var sectionMetaEl = document.getElementById("fm-section-meta");
var backPickerBtn = document.getElementById("fm-back-picker-btn");
var pdfCanvas = document.getElementById("fm-pdf-canvas");
var overlayCanvas = document.getElementById("fm-overlay-canvas");
var pdfScrollEl = document.getElementById("fm-pdf-scroll");
var zoomOutBtn = document.getElementById("fm-zoom-out");
var zoomInBtn = document.getElementById("fm-zoom-in");
var zoomBtn = document.getElementById("fm-zoom-btn");
var zoomFitBtn = document.getElementById("fm-zoom-fit");
var zoomLabelEl = document.getElementById("fm-zoom-label");
var discoverBtn = document.getElementById("fm-discover-btn");
var discoverMinWrapEl = document.getElementById("fm-discover-min-wrap");
var discoverMinSizeEl = document.getElementById("fm-discover-min-size");
var discoverHintEl = document.getElementById("fm-discover-hint");
var calibrateBtn = document.getElementById("fm-calibrate-btn");
var calibrateLedEl = document.getElementById("fm-calibrate-led");
var detailBtn = document.getElementById("fm-detail-btn");
var detailDockEl = document.getElementById("fm-detail-dock");
var detailHintEl = document.getElementById("fm-detail-hint");
var detailRepickBtn = document.getElementById("fm-detail-repick-btn");
var detailCloseBtn = document.getElementById("fm-detail-close-btn");
var scaleStatusEl = document.getElementById("fm-scale-status");
var calibrateMetresWrap = document.getElementById("fm-calibrate-metres-wrap");
var calibrateMetresInput = document.getElementById("fm-calibrate-metres");
var calibrateApplyBtn = document.getElementById("fm-calibrate-apply-btn");
var calibrateRepickBtn = document.getElementById("fm-calibrate-repick-btn");
var calibrateHintEl = document.getElementById("fm-calibrate-hint");
var copyLayoutBarEl = document.getElementById("fm-copy-layout-bar");
var copyLayoutCb = document.getElementById("fm-copy-layout-cb");
var copyLayoutControlsEl = document.getElementById("fm-copy-layout-controls");
var copyLayoutSourceEl = document.getElementById("fm-copy-layout-source");
var copyLayoutRemapVgCb = document.getElementById(
  "fm-copy-layout-remap-vg"
);
var copyLayoutBtn = document.getElementById("fm-copy-layout-btn");
var copyGevelBarEl = document.getElementById("fm-copy-gevel-bar");
var copyGevelCb = document.getElementById("fm-copy-gevel-cb");
var copyGevelControlsEl = document.getElementById("fm-copy-gevel-controls");
var copyGevelSourceEl = document.getElementById("fm-copy-gevel-source");
var copyGevelBtn = document.getElementById("fm-copy-gevel-btn");
var gevelCopySources = null;
var gevelCopySourcesLoading = false;
var toolClearBtn = document.getElementById("fm-tool-clear-btn");
var toolHintEl = document.getElementById("fm-tool-hint");
var toolLengthMmEl = document.getElementById("fm-tool-length-mm");
var toolCircMmEl = document.getElementById("fm-tool-circ-mm");
var toolAreaMm2El = document.getElementById("fm-tool-area-mm2");
var roomLabelInput = document.getElementById("fm-room-label");
var roomVgInput = document.getElementById("fm-room-vg");
var roomVrInput = document.getElementById("fm-room-vr");
var vgVrRowEl = document.getElementById("fm-vg-vr-row");
var vgVrHintEl = document.getElementById("fm-vg-vr-hint");
var expectedOriBlockEl = document.getElementById("fm-expected-ori-block");
var expectedOriRowEl = document.getElementById("fm-expected-ori-row");
var expectedOriCorrEl = document.getElementById("fm-ori-corr-rows");
var componentOriBlockEl = document.getElementById("fm-component-ori-block");
var componentOriEl = document.getElementById("fm-component-ori");
var roomLevelSelect = document.getElementById("fm-room-level");
var roomPendingHintEl = document.getElementById("fm-room-pending-hint");
var roomDrawBtn = document.getElementById("fm-room-draw-btn");
var roomCloseBtn = document.getElementById("fm-room-close-btn");
var roomSimplifyBtn = document.getElementById("fm-room-simplify-btn");
var roomSaveBtn = document.getElementById("fm-room-save-btn");
var roomDuplicateBtn = document.getElementById("fm-room-duplicate-btn");
var roomClearBtn = document.getElementById("fm-room-clear-btn");
var roomDeleteBtn = document.getElementById("fm-room-delete-btn");
var discoverBtnSide = document.getElementById("fm-discover-btn-side");
var setOpsFieldset = document.getElementById("fm-set-ops-fieldset");
var materialBlockEl = document.getElementById("fm-material-block");
var kierSuggestEl = document.getElementById("fm-kier-suggest");
var kierSuggestCb = document.getElementById("fm-kier-suggest-cb");
var kierSuggestHintEl = document.getElementById("fm-kier-suggest-hint");
var kierSuggestMatEl = document.getElementById("fm-kier-suggest-mat");
var kierSuggestNewBtn = document.getElementById("fm-kier-suggest-new");
var composePartsEl = document.getElementById("fm-compose-parts");
var composeFeedbackEl = document.getElementById("fm-compose-feedback");
var materialCategoryEl = document.getElementById("fm-material-category");
var materialSubcategoryEl = document.getElementById(
  "fm-material-subcategory"
);
var materialFilterEl = document.getElementById("fm-material-filter");
var materialFavoriteEl = document.getElementById("fm-material-favorite");
var favoriteAddBtn = document.getElementById("fm-favorite-add-btn");
var favoriteRemoveBtn = document.getElementById("fm-favorite-remove-btn");
var presetSaveBtn = document.getElementById("fm-preset-save-btn");
var presetApplyBtn = document.getElementById("fm-preset-apply-btn");
var materialIdEl = document.getElementById("fm-material-id");
var openMatCatalogBtn = document.getElementById("fm-open-mat-btn");
var customMatToggleBtn = document.getElementById("fm-custom-mat-toggle");
var replaceMatEl = document.getElementById("fm-replace-mat");
var replaceMatCb = document.getElementById("fm-replace-mat-cb");
var replaceMatControlsEl = document.getElementById("fm-replace-mat-controls");
var replaceMatFromEl = document.getElementById("fm-replace-mat-from");
var replaceMatToEl = document.getElementById("fm-replace-mat-to");
var replaceMatHintEl = document.getElementById("fm-replace-mat-hint");
var replaceMatBtn = document.getElementById("fm-replace-mat-btn");
var materialSpectrumEl = document.getElementById("fm-material-spectrum");
var materialR125El = document.getElementById("fm-r125");
var materialR250El = document.getElementById("fm-r250");
var materialR500El = document.getElementById("fm-r500");
var materialR1000El = document.getElementById("fm-r1000");
var materialR2000El = document.getElementById("fm-r2000");
var materialRaEl = document.getElementById("fm-ra");
var setApplyBtn = document.getElementById("fm-set-apply-btn");
var setClearSelBtn = document.getElementById("fm-set-clear-sel-btn");
var discoveryDockEl = document.getElementById("fm-discovery-dock");
var editDockEl = document.getElementById("fm-edit-dock");
var discoveryProgressEl = document.getElementById("fm-discovery-progress");
var discoveryHintEl = document.getElementById("fm-discovery-hint");
var discoveryLabelInput = document.getElementById("fm-discovery-label");
var discoveryLevelSelect = document.getElementById("fm-discovery-level");
var discoveryAcceptBtn = document.getElementById("fm-discovery-accept");
var discoverySkipBtn = document.getElementById("fm-discovery-skip");
var discoveryCancelBtn = document.getElementById("fm-discovery-cancel");
var discoverySimplifyBtn = document.getElementById("fm-discovery-simplify");
var nudgeLeftBtn = document.getElementById("fm-nudge-left");
var nudgeRightBtn = document.getElementById("fm-nudge-right");
var nudgeUpBtn = document.getElementById("fm-nudge-up");
var nudgeDownBtn = document.getElementById("fm-nudge-down");
var editNudgeLeftBtn = document.getElementById("fm-edit-nudge-left");
var editNudgeRightBtn = document.getElementById("fm-edit-nudge-right");
var editNudgeUpBtn = document.getElementById("fm-edit-nudge-up");
var editNudgeDownBtn = document.getElementById("fm-edit-nudge-down");
var roomCountEl = document.getElementById("fm-room-count");
var roomsHintEl = document.getElementById("fm-rooms-hint");
var roomListEl = document.getElementById("fm-room-list");
var gaLinkEl = document.getElementById("fm-ga-link");
var fileMenuRoot = document.getElementById("fm-file-menu");
var markRoomLegendEl = document.querySelector("#fm-mark-room-fieldset legend");
var savedRoomsHeadingEl = document.getElementById("fm-saved-heading");
var savedHeadingTextEl = document.getElementById("fm-saved-heading-text");
var roomVrFilterEl = document.getElementById("fm-room-vr-filter");
var savedVrFilterWrapEl = document.querySelector(".saved-vr-filter");
var pickerHeadingEl = document.querySelector("#fm-picker-panel h2");
var pickerHintEl = document.querySelector("#fm-picker-panel .fm-picker-head .hint");
var vgVrOverviewBtn = document.getElementById("fm-vgvr-overview-btn");
var vgVrOverviewDialog = document.getElementById("fm-vgvr-overview-dialog");
var vgVrOverviewTitleEl = document.getElementById("fm-vgvr-overview-title");
var vgVrOverviewMetaEl = document.getElementById("fm-vgvr-overview-meta");
var vgVrOverviewBodyEl = document.getElementById("fm-vgvr-overview-body");
var vgVrOverviewCopyBtn = document.getElementById("fm-vgvr-overview-copy");
var pageTitleEl = document.querySelector("h1");
function activePartNoun() {
  return partNoun(activeSection?.region_kind);
}
function isFloormapKind(kind) {
  return String(kind || activeSection?.region_kind || "FLOORMAP").toUpperCase() === "FLOORMAP";
}
var ORIENTATIE_CODES = ["N", "NO", "O", "ZO", "Z", "ZW", "W", "NW"];
function readExpectedOrientaties() {
  if (!expectedOriRowEl) return [];
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const input of expectedOriRowEl.querySelectorAll("input[type=checkbox]")) {
    const el = input;
    if (!el.checked) continue;
    const code = normalizeOrientatieCode(el.value);
    if (!ORIENTATIE_CODES.includes(code) || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}
function readOrientatieCorrecties() {
  const out = {};
  for (const code of readExpectedOrientaties()) {
    const clEl = document.getElementById(`fm-ori-cl-${code}`);
    const cgEl = document.getElementById(`fm-ori-cg-${code}`);
    const cl = clEl?.value.trim() === "" ? 0 : Number(clEl?.value);
    const cg = cgEl?.value.trim() === "" ? 0 : Number(cgEl?.value);
    out[code] = {
      cl_db: Number.isFinite(cl) ? cl : 0,
      cg_db: Number.isFinite(cg) ? cg : 0
    };
  }
  return out;
}
function syncOriCorrRows(preserve) {
  if (!expectedOriCorrEl) return;
  const codes = readExpectedOrientaties();
  const prev = {};
  for (const code of ORIENTATIE_CODES) {
    const clEl = document.getElementById(`fm-ori-cl-${code}`);
    const cgEl = document.getElementById(`fm-ori-cg-${code}`);
    if (!clEl && !cgEl) continue;
    prev[code] = {
      cl_db: Number(clEl?.value) || 0,
      cg_db: Number(cgEl?.value) || 0
    };
  }
  expectedOriCorrEl.innerHTML = "";
  if (!codes.length) {
    expectedOriCorrEl.classList.add("hidden");
    return;
  }
  expectedOriCorrEl.classList.remove("hidden");
  const head = document.createElement("p");
  head.className = "fm-ori-corr-label";
  head.textContent = "CL / Cg per gevelori\xEBntatie (dB) \u2014 gevelcorrectie in D2m,nT";
  expectedOriCorrEl.appendChild(head);
  for (const code of codes) {
    const fromPreserve = preserve?.[code];
    const fromDom = prev[code];
    const cl = fromPreserve?.cl_db != null && Number.isFinite(Number(fromPreserve.cl_db)) ? Number(fromPreserve.cl_db) : fromDom?.cl_db ?? 0;
    const cg = fromPreserve?.cg_db != null && Number.isFinite(Number(fromPreserve.cg_db)) ? Number(fromPreserve.cg_db) : fromDom?.cg_db ?? 0;
    const row = document.createElement("div");
    row.className = "fm-ori-corr-row";
    row.innerHTML = `
      <span class="fm-ori-corr-code">${code}</span>
      <label>CL <input id="fm-ori-cl-${code}" type="text" inputmode="decimal" value="${cl}" aria-label="CL ${code}" /></label>
      <label>Cg <input id="fm-ori-cg-${code}" type="text" inputmode="decimal" value="${cg}" aria-label="Cg ${code}" /></label>
    `;
    expectedOriCorrEl.appendChild(row);
  }
}
function setExpectedOrientaties(codes, correcties) {
  if (!expectedOriRowEl) return;
  const want = new Set(
    (codes || []).map((c) => normalizeOrientatieCode(c)).filter((c) => ORIENTATIE_CODES.includes(c))
  );
  for (const input of expectedOriRowEl.querySelectorAll("input[type=checkbox]")) {
    const el = input;
    el.checked = want.has(normalizeOrientatieCode(el.value));
  }
  syncOriCorrRows(correcties || null);
}
function clearExpectedOrientaties() {
  setExpectedOrientaties([], {});
}
function readComponentOrientatie() {
  const raw = componentOriEl?.value || "";
  const code = normalizeOrientatieCode(raw);
  return ORIENTATIE_CODES.includes(code) ? code : "";
}
var LAST_COMPONENT_ORI_KEY = "app-gevelwering-last-component-ori";
function lastComponentOriStorageKey() {
  return buildingId ? `${LAST_COMPONENT_ORI_KEY}:${buildingId}` : LAST_COMPONENT_ORI_KEY;
}
function loadLastComponentOrientatie() {
  try {
    const raw = sessionStorage.getItem(lastComponentOriStorageKey()) || "";
    const code = normalizeOrientatieCode(raw);
    return ORIENTATIE_CODES.includes(code) ? code : "";
  } catch {
    return "";
  }
}
var lastComponentOrientatie = "";
function rememberComponentOrientatie(code) {
  const want = normalizeOrientatieCode(code || "");
  if (!ORIENTATIE_CODES.includes(want)) return;
  lastComponentOrientatie = want;
  try {
    sessionStorage.setItem(lastComponentOriStorageKey(), want);
  } catch {
  }
}
function refreshLastComponentOrientatieFromStorage() {
  lastComponentOrientatie = loadLastComponentOrientatie();
}
function setComponentOrientatie(code) {
  if (!componentOriEl) return;
  const want = normalizeOrientatieCode(code || "");
  componentOriEl.value = want && ORIENTATIE_CODES.includes(want) ? want : "";
}
function applyComponentOrientatieForEdit(saved) {
  const fromSaved = normalizeOrientatieCode(saved || "");
  const hasSaved = ORIENTATIE_CODES.includes(fromSaved);
  if (hasSaved) {
    setComponentOrientatie(fromSaved);
    rememberComponentOrientatie(fromSaved);
    return;
  }
  setComponentOrientatie(lastComponentOrientatie);
}
function clearComponentOrientatie() {
  setComponentOrientatie("");
}
function gevelAnalysisForSave(prev, extra) {
  const ori = readComponentOrientatie();
  if (!ori) {
    throw new Error("Kies een gevelori\xEBntatie (N\u2026NW) voor dit component");
  }
  const base = prev && typeof prev === "object" ? { ...prev } : {};
  delete base.expected_orientaties;
  delete base.orientatie_correcties;
  return {
    ...base,
    ...extra || {},
    orientatie: ori
  };
}
function parseVgVrInputs() {
  const vgRaw = roomVgInput.value.trim();
  const vrRaw = roomVrInput.value.trim();
  if (!vgRaw && !vrRaw) return { vg_nr: null, vr_nr: null };
  if (!vgRaw || !vrRaw) return { vg_nr: null, vr_nr: null, error: "Vul zowel VG als VR in" };
  const vg = Number(vgRaw);
  if (!Number.isInteger(vg) || vg < 1) {
    return { vg_nr: null, vr_nr: null, error: "VG moet een geheel getal \u2265 1 zijn" };
  }
  if (!/^[0-9A-Za-z][0-9A-Za-z._-]{0,15}$/.test(vrRaw)) {
    return {
      vg_nr: null,
      vr_nr: null,
      error: "VR moet een id zijn zoals 3 of 3A (letters/cijfers, max. 16)"
    };
  }
  return { vg_nr: vg, vr_nr: vrRaw };
}
function subsectionAreaNorm(r) {
  return r.area_norm != null ? Number(r.area_norm) : shoelaceArea(r.points);
}
function sortByAreaDesc(selected) {
  return selected.slice().sort((a, b) => subsectionAreaNorm(b) - subsectionAreaNorm(a));
}
function differenceSubject(selected) {
  if (!selected.length) return null;
  return sortByAreaDesc(selected)[0] ?? null;
}
function resolveComponentVgVr(selected) {
  const form = parseVgVrInputs();
  if (form.error) return form;
  const vrs = [
    ...new Set(
      selected.map((r) => r.vr_nr != null && String(r.vr_nr).trim() ? String(r.vr_nr).trim() : null).filter((v) => Boolean(v))
    )
  ];
  const vgs = [
    ...new Set(
      selected.map((r) => r.vg_nr != null ? Number(r.vg_nr) : null).filter((v) => v != null && Number.isFinite(v))
    )
  ];
  const subj = differenceSubject(selected);
  let inherited = null;
  if (vrs.length === 1 && vgs.length === 1) {
    inherited = { vg_nr: vgs[0], vr_nr: vrs[0] };
  } else if (subj?.vg_nr != null && subj.vr_nr) {
    inherited = { vg_nr: Number(subj.vg_nr), vr_nr: String(subj.vr_nr).trim() };
  } else if (vrs.length === 1 && subj?.vg_nr != null) {
    inherited = { vg_nr: Number(subj.vg_nr), vr_nr: vrs[0] };
  } else if (vrs.length > 1) {
    return {
      vg_nr: null,
      vr_nr: null,
      error: `Geselecteerde bronnen hebben verschillende VR\u2019s (${vrs.join(", ")}). Maak die gelijk v\xF3\xF3r compositie.`
    };
  }
  if (inherited) {
    if (form.vg_nr != null && form.vr_nr != null && (form.vg_nr !== inherited.vg_nr || form.vr_nr !== inherited.vr_nr)) {
      return {
        vg_nr: null,
        vr_nr: null,
        error: `Geselecteerde bronnen zijn VG ${inherited.vg_nr} \xB7 VR ${inherited.vr_nr}, maar het formulier heeft VG ${form.vg_nr} \xB7 VR ${form.vr_nr}. Zet het formulier gelijk of leeg VG/VR.`
      };
    }
    return inherited;
  }
  if (form.vg_nr != null && form.vr_nr != null) return form;
  return { vg_nr: null, vr_nr: null };
}
function suggestNextVrNr() {
  const ids = rooms.map((r) => r.vr_nr).filter((n) => typeof n === "string" && n.length > 0);
  const pureNums = ids.filter((id) => /^\d+$/.test(id)).map((id) => Number(id)).filter((n) => Number.isFinite(n));
  if (pureNums.length === ids.length) {
    return String((pureNums.length ? Math.max(...pureNums) : 0) + 1);
  }
  return "";
}
function suggestVgNr() {
  for (let i = rooms.length - 1; i >= 0; i--) {
    if (rooms[i].vg_nr != null) return rooms[i].vg_nr;
  }
  const filterVr = normalizeVrNr(roomListVrFilter) || normalizeVrNr(roomVrInput.value);
  if (filterVr && buildingVrToVg.has(filterVr)) return buildingVrToVg.get(filterVr);
  return 1;
}
function suggestFacadeVrNr() {
  if (roomListVrFilter) return roomListVrFilter;
  const counts = /* @__PURE__ */ new Map();
  for (const r of rooms) {
    const vr = normalizeVrNr(r.vr_nr);
    if (!vr) continue;
    counts.set(vr, (counts.get(vr) || 0) + 1);
  }
  let best = "";
  let bestN = 0;
  for (const [vr, n] of counts) {
    if (n > bestN) {
      best = vr;
      bestN = n;
    }
  }
  return best;
}
function fillVgVrSuggestions() {
  if (!isFloormapKind()) {
    if (!roomVgInput.value.trim()) roomVgInput.value = String(suggestVgNr());
    if (!roomVrInput.value.trim()) roomVrInput.value = suggestFacadeVrNr();
    return;
  }
  roomVgInput.value = String(suggestVgNr());
  roomVrInput.value = String(suggestNextVrNr());
}
function vgVrPairKey(vg, vr) {
  return `${vg}\0${normalizeVrNr(vr) || ""}`;
}
function floormapCopySourceCandidates() {
  if (!activeSection) return [];
  return sections.filter(
    (s) => isFloormapKind(s.region_kind) && s.id !== activeSection.id && (s.room_count || 0) >= 1
  ).slice().sort((a, b) => (a.label || "").localeCompare(b.label || "", "nl"));
}
function syncCopyLayoutUi() {
  if (!copyLayoutBarEl) return;
  const show = Boolean(activeSection && isFloormapKind());
  copyLayoutBarEl.classList.toggle("hidden", !show);
  if (!show) {
    if (copyLayoutCb) copyLayoutCb.checked = false;
    copyLayoutControlsEl?.classList.add("hidden");
    return;
  }
  const enabled = Boolean(copyLayoutCb?.checked);
  copyLayoutControlsEl?.classList.toggle("hidden", !enabled);
  if (!copyLayoutSourceEl) return;
  const prev = copyLayoutSourceEl.value;
  const sources = floormapCopySourceCandidates();
  copyLayoutSourceEl.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = sources.length ? "\u2014 kies plattegrond \u2014" : "\u2014 geen andere plattegrond met ruimten \u2014";
  copyLayoutSourceEl.appendChild(placeholder);
  for (const s of sources) {
    const opt = document.createElement("option");
    opt.value = s.id;
    const n = s.room_count || 0;
    opt.textContent = `${s.label || "Plattegrond"} (${n} ruimte${n === 1 ? "" : "n"})`;
    copyLayoutSourceEl.appendChild(opt);
  }
  if (prev && sources.some((s) => s.id === prev)) copyLayoutSourceEl.value = prev;
  if (copyLayoutBtn) {
    copyLayoutBtn.disabled = !(enabled && copyLayoutSourceEl.value);
  }
}
async function fetchSectionRooms(sectionId) {
  if (!auth()?.token) return [];
  const raw = bppPhase1Enabled() ? (await bppListDrawingSubsections(invokeString, auth().token, sectionId)).subsections : (await apiGet(
    `/api/floormap/subsections?section_id=${encodeURIComponent(sectionId)}`
  )).subsections;
  return mapSubsectionRows(raw).sort(
    (a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, "nl")
  );
}
async function collectProjectVgVrPairs(excludeSectionId) {
  const pairs = /* @__PURE__ */ new Set();
  let maxVg = 0;
  for (const s of sections) {
    if (!isFloormapKind(s.region_kind)) continue;
    if ((s.room_count || 0) < 1 && s.id !== activeSection?.id) continue;
    const list = s.id === activeSection?.id ? rooms : await fetchSectionRooms(s.id);
    const skipPairs = Boolean(excludeSectionId && s.id === excludeSectionId);
    for (const r of list) {
      if (r.vg_nr == null || !normalizeVrNr(r.vr_nr)) continue;
      const vg = Number(r.vg_nr);
      if (vg > maxVg) maxVg = vg;
      if (!skipPairs) pairs.add(vgVrPairKey(vg, String(r.vr_nr)));
    }
  }
  return { pairs, maxVg };
}
function invalidateGevelCopySources() {
  gevelCopySources = null;
}
function parseGevelCopySourceKey(raw) {
  const parts = (raw || "").split("|");
  if (parts.length < 3) return null;
  const sectionId = parts[0].trim();
  const vr = normalizeVrNr(parts[1]);
  const ori = normalizeOrientatieCode(parts[2]);
  if (!sectionId || !vr || !ori) return null;
  return { sectionId, vr, ori };
}
async function refreshGevelCopySources() {
  if (!auth()?.token || gevelCopySourcesLoading) return;
  gevelCopySourcesLoading = true;
  try {
    const out = [];
    for (const s of sections) {
      if (isFloormapKind(s.region_kind)) continue;
      if ((s.room_count || 0) < 1 && s.id !== activeSection?.id) continue;
      let list;
      try {
        list = s.id === activeSection?.id ? rooms : await fetchSectionRooms(s.id);
      } catch {
        continue;
      }
      const groups = /* @__PURE__ */ new Map();
      for (const r of list) {
        if (isLegacySealSibling(r.analysis)) continue;
        const vr = normalizeVrNr(r.vr_nr);
        const ori = normalizeOrientatieCode(r.analysis?.orientatie || "");
        if (!vr || !ori || !ORIENTATIE_CODES.includes(ori)) continue;
        const k = `${vr}|${ori}`;
        groups.set(k, (groups.get(k) || 0) + 1);
      }
      for (const [k, count] of groups) {
        const [vr, ori] = k.split("|");
        out.push({
          key: `${s.id}|${vr}|${ori}`,
          sectionId: s.id,
          sectionLabel: (s.label || "Gevel").trim() || "Gevel",
          vr,
          ori,
          count
        });
      }
    }
    out.sort((a, b) => {
      const la = `${a.sectionLabel} \xB7 VR ${a.vr} \xB7 ${a.ori}`;
      const lb = `${b.sectionLabel} \xB7 VR ${b.vr} \xB7 ${b.ori}`;
      return la.localeCompare(lb, "nl");
    });
    gevelCopySources = out;
  } finally {
    gevelCopySourcesLoading = false;
  }
  syncCopyGevelUi();
}
function syncCopyGevelUi() {
  if (!copyGevelBarEl) return;
  const show = Boolean(activeSection && !isFloormapKind());
  copyGevelBarEl.classList.toggle("hidden", !show);
  if (!show) {
    if (copyGevelCb) copyGevelCb.checked = false;
    copyGevelControlsEl?.classList.add("hidden");
    if (copyGevelBtn) copyGevelBtn.disabled = true;
    return;
  }
  const enabled = Boolean(copyGevelCb?.checked);
  copyGevelControlsEl?.classList.toggle("hidden", !enabled);
  if (!copyGevelSourceEl) return;
  if (enabled && gevelCopySources == null && !gevelCopySourcesLoading) {
    void refreshGevelCopySources();
  }
  const prev = copyGevelSourceEl.value;
  const sources = gevelCopySources || [];
  copyGevelSourceEl.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = gevelCopySourcesLoading ? "\u2014 bronnen laden\u2026 \u2014" : sources.length ? "\u2014 kies bron (VR \xB7 ori) \u2014" : "\u2014 geen VR \xB7 ori-stack gevonden \u2014";
  copyGevelSourceEl.appendChild(ph);
  for (const s of sources) {
    const opt = document.createElement("option");
    opt.value = s.key;
    opt.textContent = `${s.sectionLabel} \xB7 VR ${s.vr} \xB7 ${s.ori} \xB7 ${s.count} component${s.count === 1 ? "" : "en"}`;
    copyGevelSourceEl.appendChild(opt);
  }
  if (prev && sources.some((s) => s.key === prev)) copyGevelSourceEl.value = prev;
  if (copyGevelBtn) {
    copyGevelBtn.disabled = !(enabled && copyGevelSourceEl.value);
  }
}
function unionStackBBox(stack) {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  let any = false;
  const consider = (pts) => {
    for (const p of pts) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      any = true;
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  };
  for (const r of stack) {
    consider(r.points || []);
    if (Array.isArray(r.analysis?.holes)) {
      for (const h of r.analysis.holes) consider(coerceRingPoints(h));
    }
  }
  if (!any) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  return { minX, minY, maxX, maxY };
}
function topoSortFacadeStack(items) {
  const byId = new Map(items.map((r) => [r.id, r]));
  const remaining = new Set(items.map((r) => r.id));
  const out = [];
  while (remaining.size) {
    let progress = false;
    for (const id of [...remaining]) {
      const r = byId.get(id);
      const deps = isComposeResultRoom(r) ? (r.analysis?.source_subsection_ids || []).filter((d) => byId.has(d)) : [];
      if (deps.every((d) => !remaining.has(d))) {
        out.push(r);
        remaining.delete(id);
        progress = true;
      }
    }
    if (progress) continue;
    for (const id of [...remaining]) {
      const r = byId.get(id);
      if (!isComposeResultRoom(r)) {
        out.push(r);
        remaining.delete(id);
        progress = true;
      }
    }
    if (progress) continue;
    for (const id of [...remaining]) {
      out.push(byId.get(id));
      remaining.delete(id);
    }
  }
  return out;
}
async function collectFacadeStackForCopy(sectionId, vr, ori) {
  const list = sectionId === activeSection?.id ? rooms.slice() : await fetchSectionRooms(sectionId);
  const wantVr = normalizeVrNr(vr);
  const wantOri = normalizeOrientatieCode(ori);
  const primary = list.filter((r) => {
    if (isLegacySealSibling(r.analysis)) return false;
    if (normalizeVrNr(r.vr_nr) !== wantVr) return false;
    return normalizeOrientatieCode(r.analysis?.orientatie || "") === wantOri;
  });
  if (!primary.length) return [];
  const byId = new Map(list.map((r) => [r.id, r]));
  const stack = /* @__PURE__ */ new Map();
  for (const r of primary) stack.set(r.id, r);
  let grew = true;
  while (grew) {
    grew = false;
    for (const r of [...stack.values()]) {
      if (!isComposeResultRoom(r)) continue;
      for (const sid of r.analysis?.source_subsection_ids || []) {
        if (!sid || stack.has(sid)) continue;
        const src = byId.get(sid);
        if (!src || isLegacySealSibling(src.analysis)) continue;
        stack.set(sid, src);
        grew = true;
      }
    }
  }
  return topoSortFacadeStack([...stack.values()]);
}
function analysisForFacadeStackClone(src, idMap, targetOri, translatedHoles) {
  const analysis = {};
  if (src?.material_id) analysis.material_id = src.material_id;
  if (src?.master_category) analysis.master_category = src.master_category;
  if (src?.material_name) analysis.material_name = src.material_name;
  if (src?.catalog_id) analysis.catalog_id = src.catalog_id;
  if (src?.category) analysis.category = src.category;
  if (src?.rubriek_nr != null) analysis.rubriek_nr = src.rubriek_nr;
  if (src?.material_kind) analysis.material_kind = src.material_kind;
  if (src?.repeat_count != null && Number(src.repeat_count) > 1) {
    analysis.repeat_count = Math.max(1, Math.min(99, Math.round(Number(src.repeat_count))));
  }
  if (src?.quantity_kind === "length") {
    analysis.quantity_kind = "length";
    if (src.length_m != null) analysis.length_m = src.length_m;
    if (src.length_norm != null) analysis.length_norm = src.length_norm;
    if (src.open_path) analysis.open_path = true;
  }
  analysis.orientatie = targetOri;
  const seal = readComponentSeal(src);
  if (seal?.enabled) {
    analysis.seal = {
      enabled: true,
      material_id: seal.material_id,
      catalog_id: seal.catalog_id,
      material_name: seal.material_name,
      master_category: seal.master_category,
      category: seal.category,
      rubriek_nr: seal.rubriek_nr,
      length_m: seal.length_m
    };
  }
  const op = parseBooleanOp(src?.boolean_op);
  if (op === "compose" || op === "difference") {
    analysis.boolean_op = op;
    const srcIds = (src?.source_subsection_ids || []).map((id) => idMap.get(id) || "").filter(Boolean);
    if (srcIds.length) analysis.source_subsection_ids = srcIds;
    if (src?.outer_subsection_id) {
      const mapped = idMap.get(src.outer_subsection_id);
      if (mapped) analysis.outer_subsection_id = mapped;
    }
    if (src?.constituent_signs && typeof src.constituent_signs === "object") {
      const signs = {};
      for (const [oldId, sign] of Object.entries(src.constituent_signs)) {
        const nid = idMap.get(oldId);
        if (nid && (sign === "+" || sign === "-")) signs[nid] = sign;
      }
      if (Object.keys(signs).length) analysis.constituent_signs = signs;
    }
    if (Array.isArray(src?.source_labels) && src.source_labels.length) {
      analysis.source_labels = src.source_labels.slice();
    }
  }
  if (translatedHoles.length) analysis.holes = translatedHoles;
  return analysis;
}
async function copyGevelStackFromSource(sourceKey) {
  if (!activeSection || !auth()?.token) {
    setStatus("Geen geveltekening actief", "err");
    return;
  }
  if (isFloormapKind()) {
    setStatus("Gevelstack kopi\xEBren kan alleen op een open geveltekening", "err");
    return;
  }
  const parsed = parseGevelCopySourceKey(sourceKey);
  if (!parsed) {
    setStatus("Kies een bron VR \xB7 ori", "err");
    return;
  }
  const targetVgRaw = roomVgInput.value.trim();
  const targetVr = normalizeVrNr(roomVrInput.value);
  const targetVg = targetVgRaw ? Number(targetVgRaw) : NaN;
  const targetOri = readComponentOrientatie();
  if (!Number.isFinite(targetVg) || targetVg <= 0 || !targetVr) {
    setStatus("Vul rechts VG en VR in voor de doelstack", "err");
    return;
  }
  if (!targetOri || !ORIENTATIE_CODES.includes(targetOri)) {
    setStatus("Kies rechts de gevelori\xEBntatie voor de doelstack", "err");
    return;
  }
  if (parsed.sectionId === activeSection.id && parsed.vr === targetVr && parsed.ori === targetOri) {
    setStatus("Bron en doel zijn dezelfde VR \xB7 ori op deze gevel \u2014 kies een andere bron of ori", "err");
    return;
  }
  setStatus("Bronstack laden\u2026", "busy");
  const stack = await collectFacadeStackForCopy(parsed.sectionId, parsed.vr, parsed.ori);
  if (!stack.length) {
    setStatus(`Geen componenten voor VR ${parsed.vr} \xB7 ${parsed.ori}`, "err");
    return;
  }
  const conflict = rooms.filter((r) => {
    if (isLegacySealSibling(r.analysis)) return false;
    if (normalizeVrNr(r.vr_nr) !== targetVr) return false;
    return normalizeOrientatieCode(r.analysis?.orientatie || "") === targetOri;
  });
  if (conflict.length) {
    const ok = window.confirm(
      `Op deze gevel staan al ${conflict.length} component(en) voor VR ${targetVr} \xB7 ${targetOri}.

Toch ${stack.length} component(en) van VR ${parsed.vr} \xB7 ${parsed.ori} toevoegen (gecentreerd)?`
    );
    if (!ok) {
      setStatus("Kopi\xEBren geannuleerd", "err");
      return;
    }
  } else {
    const srcSec = sections.find((s) => s.id === parsed.sectionId);
    const ok = window.confirm(
      `${stack.length} component(en) kopi\xEBren van VR ${parsed.vr} \xB7 ${parsed.ori}${srcSec ? ` (\xAB${srcSec.label || "bron"}\xBB)` : ""} naar VG ${targetVg} \xB7 VR ${targetVr} \xB7 ${targetOri} op deze gevel (gecentreerd)?`
    );
    if (!ok) {
      setStatus("Kopi\xEBren geannuleerd", "err");
      return;
    }
  }
  const box = unionStackBBox(stack);
  const dx = 0.5 - (box.minX + box.maxX) / 2;
  const dy = 0.5 - (box.minY + box.maxY) / 2;
  const mpu = activeScaleMpu();
  const idMap = /* @__PURE__ */ new Map();
  let savedN = 0;
  if (copyGevelBtn) copyGevelBtn.disabled = true;
  try {
    for (let i = 0; i < stack.length; i++) {
      const r = stack[i];
      setStatus(`Component ${i + 1}/${stack.length} kopi\xEBren\u2026`, "busy");
      const asLength = componentIsLengthQuantity(r) || r.analysis?.quantity_kind === "length" || isLengthQuantityRubriek(r.analysis?.rubriek_nr ?? r.analysis?.master_category);
      const openPath = Boolean(asLength && r.analysis?.open_path);
      const srcPoints = (r.points || []).map((p) => ({ ...p }));
      const copyPoints = openPath ? clampPath(srcPoints.map((p) => ({ x: p.x + dx, y: p.y + dy }))) : translateRing(srcPoints, dx, dy);
      if (openPath) {
        if (copyPoints.length < 2) {
          throw new Error(`\xAB${r.label}\xBB: kierdichting heeft te weinig punten`);
        }
      } else if (copyPoints.length < 4) {
        throw new Error(`\xAB${r.label}\xBB: polygon heeft te weinig punten`);
      }
      const holesSrc = asLength ? [] : (Array.isArray(r.analysis?.holes) ? r.analysis.holes : []).map((h) => coerceRingPoints(h)).filter((h) => h.length >= 3).map((h) => translateRing(h, dx, dy));
      const analysis = analysisForFacadeStackClone(
        r.analysis,
        idMap,
        targetOri,
        holesSrc
      );
      const body = {
        section_id: activeSection.id,
        label: r.label,
        level_hint: r.level_hint || "OTHER",
        vg_nr: targetVg,
        vr_nr: targetVr,
        points: copyPoints,
        holes: holesSrc,
        metres_per_norm_unit: mpu ?? void 0,
        scale_aspect_yx: activeScaleAspect()
      };
      if (openPath) body.open_path = true;
      if (Object.keys(analysis).length) body.analysis = analysis;
      const saved = await saveDrawingSubsection(body);
      idMap.set(r.id, saved.subsection_id);
      upsertOptimisticRoom({
        id: saved.subsection_id,
        section_id: activeSection.id,
        label: r.label,
        level_hint: r.level_hint || "OTHER",
        vg_nr: targetVg,
        vr_nr: targetVr,
        points: copyPoints.map((p) => ({ ...p })),
        area_m2: saved.area_m2 != null ? Number(saved.area_m2) : r.area_m2,
        area_norm: saved.area_norm != null ? Number(saved.area_norm) : r.area_norm,
        perimeter_m: saved.perimeter_m != null ? Number(saved.perimeter_m) : r.perimeter_m,
        perimeter_norm: null,
        metres_per_norm_unit: mpu,
        analysis_status: "ok",
        sort_order: rooms.length,
        analysis: body.analysis ?? null
      });
      savedN += 1;
    }
    await loadRooms({ preserveOrder: true });
    invalidateGevelCopySources();
    try {
      const fresh = await fetchFloormapSections(buildingId);
      sections = fresh;
    } catch {
      if (activeSection) {
        activeSection.room_count = rooms.length;
        const idx = sections.findIndex((s) => s.id === activeSection.id);
        if (idx >= 0) sections[idx] = activeSection;
      }
    }
    renderRoomList();
    drawOverlay();
    if (copyGevelCb) copyGevelCb.checked = false;
    syncCopyGevelUi();
    setStatus(
      `${savedN} component(en) gekopieerd (VR ${parsed.vr} \xB7 ${parsed.ori} \u2192 VR ${targetVr} \xB7 ${targetOri}, gecentreerd). Sleep hoekpunten om bij te stellen.`,
      "ok"
    );
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
    try {
      await loadRooms();
    } catch {
    }
    renderRoomList();
    drawOverlay();
    syncCopyGevelUi();
  }
}
function isSimpleLayoutRoom(r) {
  if (componentIsLengthQuantity(r)) return false;
  if (isComposeResultRoom(r)) return false;
  if (!r.points || r.points.length < 3) return false;
  return true;
}
async function copyLayoutFromSection(sourceSectionId) {
  if (!activeSection || !auth()?.token) {
    setStatus("Geen plattegrond actief", "err");
    return;
  }
  if (!isFloormapKind()) {
    setStatus("Ruimte-indeling kopi\xEBren kan alleen op een plattegrond", "err");
    return;
  }
  if (sourceSectionId === activeSection.id) {
    setStatus("Kies een andere plattegrond als bron", "err");
    return;
  }
  const sourceSec = sections.find((s) => s.id === sourceSectionId);
  if (!sourceSec) {
    setStatus("Bronplattegrond niet gevonden", "err");
    return;
  }
  setStatus("Bronindeling laden\u2026", "busy");
  const sourceRooms = (await fetchSectionRooms(sourceSectionId)).filter(isSimpleLayoutRoom);
  if (!sourceRooms.length) {
    setStatus("Bronplattegrond heeft geen kopieerbare ruimten", "err");
    return;
  }
  if (rooms.length > 0) {
    const ok = window.confirm(
      `Deze plattegrond heeft al ${rooms.length} ruimte(n).

Toch ${sourceRooms.length} ruimte(n) van \xAB${sourceSec.label || "bron"}\xBB toevoegen?`
    );
    if (!ok) {
      setStatus("Kopi\xEBren geannuleerd", "err");
      return;
    }
  } else {
    const ok = window.confirm(
      `${sourceRooms.length} ruimte(n) kopi\xEBren van \xAB${sourceSec.label || "bron"}\xBB naar \xAB${activeSection.label || "deze plattegrond"}\xBB?`
    );
    if (!ok) {
      setStatus("Kopi\xEBren geannuleerd", "err");
      return;
    }
  }
  const remapVg = copyLayoutRemapVgCb?.checked !== false;
  const { pairs: usedPairs, maxVg } = await collectProjectVgVrPairs(sourceSectionId);
  const srcVgs = [
    ...new Set(
      sourceRooms.map((r) => r.vg_nr != null ? Number(r.vg_nr) : null).filter((v) => v != null && v > 0)
    )
  ].sort((a, b) => a - b);
  const vgMap = /* @__PURE__ */ new Map();
  if (remapVg) {
    let next = Math.max(0, maxVg) + 1;
    for (const vg of srcVgs) {
      vgMap.set(vg, next++);
    }
  } else {
    for (const vg of srcVgs) vgMap.set(vg, vg);
    const conflicts = [];
    for (const r of sourceRooms) {
      if (r.vg_nr == null || !normalizeVrNr(r.vr_nr)) continue;
      const key = vgVrPairKey(Number(r.vg_nr), String(r.vr_nr));
      if (usedPairs.has(key)) {
        conflicts.push(`VG ${r.vg_nr} \xB7 VR ${normalizeVrNr(r.vr_nr)}`);
      }
    }
    if (conflicts.length) {
      setStatus(
        `VG/VR al in gebruik \u2014 vink \xABNieuwe VG-nummers\xBB aan, of kies andere nummers. Conflict: ${conflicts.slice(0, 4).join(", ")}${conflicts.length > 4 ? "\u2026" : ""}`,
        "err"
      );
      return;
    }
  }
  if (!(activeSection.metres_per_norm_unit != null && activeSection.metres_per_norm_unit > 0) && sourceSec.metres_per_norm_unit != null && sourceSec.metres_per_norm_unit > 0) {
    try {
      const aspect = sourceSec.scale_aspect_yx != null && sourceSec.scale_aspect_yx > 0 ? Number(sourceSec.scale_aspect_yx) : activeScaleAspect();
      await persistSectionScale({
        section_id: activeSection.id,
        metres_per_norm_unit: Number(sourceSec.metres_per_norm_unit),
        scale_ratio: sourceSec.scale_ratio,
        scale_source: sourceSec.scale_source || "CALIBRATED",
        scale_aspect_yx: aspect
      });
      activeSection.metres_per_norm_unit = Number(sourceSec.metres_per_norm_unit);
      activeSection.scale_aspect_yx = aspect;
      activeSection.scale_source = sourceSec.scale_source || "CALIBRATED";
      activeSection.scale_ratio = sourceSec.scale_ratio;
      const idx = sections.findIndex((s) => s.id === activeSection.id);
      if (idx >= 0) sections[idx] = activeSection;
      updateScaleUi();
    } catch {
    }
  }
  const level = roomLevelSelect.value || "OTHER";
  const mpu = activeScaleMpu();
  let savedN = 0;
  if (copyLayoutBtn) copyLayoutBtn.disabled = true;
  try {
    for (let i = 0; i < sourceRooms.length; i++) {
      const r = sourceRooms[i];
      setStatus(`Ruimte ${i + 1}/${sourceRooms.length} kopi\xEBren\u2026`, "busy");
      const srcVg = r.vg_nr != null ? Number(r.vg_nr) : null;
      const vr = normalizeVrNr(r.vr_nr);
      if (srcVg == null || !vr) {
        throw new Error(`Ruimte \xAB${r.label}\xBB mist VG/VR`);
      }
      const vg = vgMap.get(srcVg) ?? srcVg;
      const holes = Array.isArray(r.analysis?.holes) ? r.analysis.holes.map((h) => coerceRingPoints(h)).filter((h) => h.length >= 3) : [];
      const analysis = analysisForDuplicate(r.analysis);
      const body = {
        section_id: activeSection.id,
        label: r.label,
        level_hint: level,
        vg_nr: vg,
        vr_nr: vr,
        points: r.points.map((p) => ({ ...p })),
        holes,
        metres_per_norm_unit: mpu ?? void 0,
        scale_aspect_yx: activeScaleAspect()
      };
      if (analysis) {
        const a = { ...analysis };
        if (holes.length) a.holes = holes;
        body.analysis = a;
      } else if (holes.length) {
        body.analysis = { holes };
      }
      const saved = await postNewSubsection(body);
      upsertOptimisticRoom({
        id: saved.subsection_id,
        section_id: activeSection.id,
        label: r.label,
        level_hint: level,
        vg_nr: vg,
        vr_nr: vr,
        points: r.points.map((p) => ({ ...p })),
        area_m2: saved.area_m2 != null ? Number(saved.area_m2) : r.area_m2,
        area_norm: saved.area_norm != null ? Number(saved.area_norm) : r.area_norm,
        perimeter_m: saved.perimeter_m != null ? Number(saved.perimeter_m) : r.perimeter_m,
        perimeter_norm: null,
        metres_per_norm_unit: mpu,
        analysis_status: "ok",
        sort_order: rooms.length,
        analysis: analysis ?? null
      });
      usedPairs.add(vgVrPairKey(vg, vr));
      savedN += 1;
    }
    await loadRooms({ preserveOrder: true });
    try {
      const fresh = await fetchFloormapSections(buildingId);
      sections = fresh;
      syncCopyLayoutUi();
    } catch {
      if (activeSection) {
        activeSection.room_count = rooms.length;
        const idx = sections.findIndex((s) => s.id === activeSection.id);
        if (idx >= 0) sections[idx] = activeSection;
      }
    }
    renderRoomList();
    drawOverlay();
    const vgNote = remapVg ? ` VG herschikt vanaf ${Math.max(0, maxVg) + 1}` : " (zelfde VG/VR als bron)";
    setStatus(
      `${savedN} ruimte(n) gekopieerd van \xAB${sourceSec.label || "bron"}\xBB.${vgNote}. Controleer labels/ori\xEBntaties.`,
      "ok"
    );
    if (copyLayoutCb) copyLayoutCb.checked = false;
    syncCopyLayoutUi();
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
    try {
      await loadRooms();
    } catch {
    }
    renderRoomList();
    drawOverlay();
    syncCopyLayoutUi();
  }
}
function syncWorkspaceLabels(kind) {
  const n = partNoun(kind ?? activeSection?.region_kind);
  const floormap = isFloormapKind(kind ?? activeSection?.region_kind);
  const cap = n.singular.charAt(0).toUpperCase() + n.singular.slice(1);
  if (pageTitleEl) pageTitleEl.textContent = `${n.title} analyseren`;
  if (pickerHeadingEl) pickerHeadingEl.textContent = "Schaalbare secties";
  if (pickerHintEl) {
    pickerHintEl.textContent = "Kies een plattegrond, gevel of doorsnede om te meten en componenten te markeren.";
  }
  if (loadBuildingBtn) loadBuildingBtn.textContent = "Ophalen";
  if (backPickerBtn) backPickerBtn.textContent = "\u2190 Overzicht";
  discoverBtn.textContent = floormap ? `Ontdek ${n.plural}` : "Ontdek openingen";
  if (discoverBtnSide) {
    discoverBtnSide.textContent = floormap ? "Ontdek" : "Ontdek in";
    discoverBtnSide.title = floormap ? `Ontdek ${n.plural} automatisch` : "Ontdek openingen (kozijnen e.d.) binnen de geselecteerde buitencontour";
  }
  if (discoverMinWrapEl) discoverMinWrapEl.classList.toggle("hidden", floormap);
  if (discoverHintEl) {
    discoverHintEl.textContent = floormap ? `Plattegrond: ruimten op de crop.` : "Gevel: selecteer buitencontour (VR), stel filtergrootte in (grof \u2192 fijn), daarna Ontdek openingen \u2014 hi-res H/V-lijnen via server, fallback lokaal.";
  }
  syncCopyLayoutUi();
  syncCopyGevelUi();
  if (markRoomLegendEl) markRoomLegendEl.textContent = cap;
  roomDrawBtn.textContent = `Teken ${n.singular}`;
  roomSaveBtn.textContent = "Opslaan";
  roomLabelInput.placeholder = floormap ? "bijv. slaapkamer 1" : "bijv. raamstrook / paneel";
  roomPendingHintEl.textContent = `Gebruik Teken ${n.singular} in Gereedschap, klik hoekpunten, sluit af en sla op. Dubbelklik een rand om een anker toe te voegen; dubbelklik een anker om te verwijderen; Vereenvoudig dunt de omtrek.`;
  if (roomDeleteBtn) {
    roomDeleteBtn.textContent = "Verwijderen";
    roomDeleteBtn.title = `Opgeslagen ${n.singular} permanent verwijderen`;
  }
  if (savedHeadingTextEl) {
    savedHeadingTextEl.textContent = `Opgeslagen ${n.plural}`;
  } else if (savedRoomsHeadingEl) {
    savedRoomsHeadingEl.textContent = `Opgeslagen ${n.plural} `;
  }
  if (savedRoomsHeadingEl && roomCountEl && document.body.contains(roomCountEl)) {
    const main = savedRoomsHeadingEl.querySelector(".saved-list-heading-main");
    if (main && !main.contains(roomCountEl)) {
      main.appendChild(roomCountEl);
    } else if (!main && !savedRoomsHeadingEl.contains(roomCountEl)) {
      savedRoomsHeadingEl.appendChild(roomCountEl);
    }
    roomCountEl.className = "region-count-badge";
    roomCountEl.id = "fm-room-count";
  }
  if (roomsHintEl) {
    roomsHintEl.textContent = floormap ? `Elke ${n.singular} toont VG/VR, oppervlakte (m\xB2) en omtrek (m) bij ingestelde schaal.` : `Kleuren: groen = in bewerking \xB7 teal = bewerkt/opgeslagen \xB7 paars = nog open. Zwarte badge = VG/VR. Oranje/groene led = materiaal. Selecteer voor +/\u2212 compositie.`;
  }
  vgVrRowEl?.classList.remove("hidden");
  if (vgVrHintEl) {
    vgVrHintEl.classList.remove("hidden");
    vgVrHintEl.textContent = floormap ? "Zelfde VG + andere VR = ruimten in hetzelfde verblijfsgebied. De combinatie VG+VR is uniek (zelfde VR in een andere VG mag)." : "Koppel aan een VR (zelfde als plattegrond). Meerdere composities (materialen) binnen dezelfde buitencontour zijn mogelijk.";
  }
  expectedOriBlockEl?.classList.toggle("hidden", !floormap);
  componentOriBlockEl?.classList.toggle("hidden", floormap);
  if (!floormap) {
    clearExpectedOrientaties();
    setComponentOrientatie(lastComponentOrientatie);
  } else {
    clearComponentOrientatie();
  }
  setOpsFieldset?.classList.toggle("hidden", floormap);
  materialBlockEl?.classList.toggle("hidden", floormap);
  if (floormap) kierSuggestEl?.classList.add("hidden");
  if (floormap) {
    selectedSetIds.clear();
    constituentSigns.clear();
    booleanPreview = null;
    projectMaterialUsages = null;
  } else {
    materialCategoriesLoaded = false;
    void ensureMaterialCategories();
  }
  syncReplaceMaterialUi();
  renderComposeParts();
}
var roomListVrFilter = "";
var buildingVrCatalog = [];
var buildingVrToVg = /* @__PURE__ */ new Map();
async function refreshBuildingVrCatalog() {
  if (!auth()?.token || !buildingId) {
    buildingVrCatalog = [];
    buildingVrToVg.clear();
    return;
  }
  const set = /* @__PURE__ */ new Set();
  buildingVrToVg.clear();
  const floormapSecs = sections.filter((s) => isFloormapKind(s.region_kind));
  const targets = floormapSecs.length ? floormapSecs : sections;
  for (const sec of targets) {
    try {
      const raw = bppPhase1Enabled() ? (await bppListDrawingSubsections(invokeString, auth().token, sec.id)).subsections : (await apiGet(`/api/floormap/subsections?section_id=${encodeURIComponent(sec.id)}`)).subsections;
      for (const row of raw || []) {
        const vr = normalizeVrNr(row.vr_nr);
        if (!vr) continue;
        set.add(vr);
        if (row.vg_nr != null && Number.isFinite(Number(row.vg_nr)) && !buildingVrToVg.has(vr)) {
          buildingVrToVg.set(vr, Number(row.vg_nr));
        }
      }
    } catch (err) {
      console.warn("building VR catalog: section failed", sec.id, err);
    }
  }
  buildingVrCatalog = [...set].sort(compareVrNr);
}
function syncRoomListVrFilterOptions(items) {
  if (!roomVrFilterEl) return;
  const onSection = collectAvailableVrNrs(items);
  const merged = /* @__PURE__ */ new Set([...buildingVrCatalog, ...onSection]);
  for (const r of items) {
    const vr = normalizeVrNr(r.vr_nr);
    if (!vr || r.vg_nr == null) continue;
    if (!buildingVrToVg.has(vr)) buildingVrToVg.set(vr, Number(r.vg_nr));
  }
  const vrs = [...merged].sort(compareVrNr);
  const prev = roomListVrFilter;
  roomVrFilterEl.replaceChildren();
  const allOpt = document.createElement("option");
  allOpt.value = "";
  allOpt.textContent = "Alle VR's";
  roomVrFilterEl.appendChild(allOpt);
  for (const vr of vrs) {
    const opt = document.createElement("option");
    opt.value = vr;
    const onThis = onSection.includes(vr);
    const vg = buildingVrToVg.get(vr);
    const vgBit = vg != null ? ` \xB7 VG ${vg}` : "";
    opt.textContent = onThis ? `VR ${vr}${vgBit}` : `VR ${vr}${vgBit} (nog niet op deze gevel)`;
    roomVrFilterEl.appendChild(opt);
  }
  roomListVrFilter = prev && vrs.includes(prev) ? prev : "";
  roomVrFilterEl.value = roomListVrFilter;
  savedVrFilterWrapEl?.classList.toggle("hidden", vrs.length === 0);
}
function visibleTopLevelRooms(items) {
  return items.filter((r) => roomMatchesVrFilter(r, roomListVrFilter));
}
function roomListCountLabel2(visible, total) {
  return roomListCountLabel(roomListVrFilter, visible, total);
}
var buildingId = URL_BUILDING;
refreshLastComponentOrientatieFromStorage();
var buildingLabel = "";
var buildingExternalRef = "";
var projectMenu = null;
var sections = [];
var activeSection = null;
var rooms = [];
var roomsLoadEpoch = 0;
var localRoomPatches = /* @__PURE__ */ new Map();
var LOCAL_ROOM_PATCH_TTL_MS = 45e3;
var LOCAL_ROOM_PATCH_READD_MS = 12e3;
var localRoomDeletions = /* @__PURE__ */ new Map();
var sectionRoomsSnapshot = /* @__PURE__ */ new Map();
function captureSectionRoomsSnapshot(sectionId) {
  if (!sectionId || !rooms.length) return;
  sectionRoomsSnapshot.set(
    sectionId,
    rooms.map((r) => ({
      ...r,
      points: r.points.map((p) => ({ ...p })),
      analysis: r.analysis ? { ...r.analysis } : r.analysis
    }))
  );
}
function overlaySectionRoomsSnapshot(sectionId, list) {
  const snap = sectionRoomsSnapshot.get(sectionId);
  if (!snap?.length) return list;
  const snapById = new Map(snap.map((r) => [normRoomId(r.id), r]));
  const merged = list.map((r) => {
    const s = snapById.get(normRoomId(r.id));
    if (!s) return r;
    const snapVr = normalizeVrNr(s.vr_nr);
    const serverVr = normalizeVrNr(r.vr_nr);
    const staleLabel = (s.label || "").trim() !== (r.label || "").trim();
    const staleVgVr = s.vg_nr !== r.vg_nr || snapVr !== serverVr;
    const useSnap = touchedRoomIds.has(normRoomId(r.id)) || localRoomPatches.has(r.id) || localRoomPatches.has(normRoomId(r.id)) || localLabelOverrides.has(normRoomId(r.id)) || staleLabel || staleVgVr;
    if (!useSnap) return r;
    return {
      ...r,
      label: s.label,
      level_hint: s.level_hint || r.level_hint,
      vg_nr: s.vg_nr,
      vr_nr: s.vr_nr
    };
  });
  const present = new Set(merged.map((r) => normRoomId(r.id)));
  for (const s of snap) {
    const id = normRoomId(s.id);
    if (present.has(id) || isLocallyDeleted(s.id)) continue;
    if (!touchedRoomIds.has(normRoomId(s.id)) && !localRoomPatches.has(id) && !localLabelOverrides.has(id)) {
      continue;
    }
    merged.push(s);
  }
  return merged.sort(
    (a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, "nl")
  );
}
async function listSectionRoomsForOverview(sectionId) {
  if (sectionId === activeSection?.id && rooms.length) {
    const fetched = await fetchSectionRooms(sectionId);
    let list2 = mergeRoomsWithLocalPatches(fetched);
    const byId = new Map(list2.map((r) => [normRoomId(r.id), r]));
    for (const r of rooms) byId.set(normRoomId(r.id), r);
    list2 = [...byId.values()].sort(
      (a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, "nl")
    );
    return overlaySectionRoomsSnapshot(sectionId, list2);
  }
  let list = mergeRoomsWithLocalPatches(await fetchSectionRooms(sectionId));
  return overlaySectionRoomsSnapshot(sectionId, list);
}
function upsertOptimisticRoom(room) {
  rooms = [...rooms.filter((r) => normRoomId(r.id) !== normRoomId(room.id)), room];
  noteLocalRoomPatch(room);
  markRoomTouched(room.id);
}
function noteLocalRoomPatch(room) {
  const sid = normRoomId(room.id);
  if (!sid || !room.points?.length) return;
  noteLocalLabel(room.id, room.label);
  localRoomPatches.set(sid, {
    at: Date.now(),
    points: room.points.map((p) => ({ ...p })),
    label: room.label,
    level_hint: room.level_hint,
    vg_nr: room.vg_nr,
    vr_nr: room.vr_nr,
    area_m2: room.area_m2,
    area_norm: room.area_norm,
    perimeter_m: room.perimeter_m,
    analysis: room.analysis ? {
      ...room.analysis,
      holes: Array.isArray(room.analysis.holes) ? room.analysis.holes.map((h) => h.map((p) => ({ ...p }))) : room.analysis.holes
    } : room.analysis
  });
}
function pruneLocalRoomPatches() {
  const now = Date.now();
  for (const [id, p] of localRoomPatches) {
    if (now - p.at > LOCAL_ROOM_PATCH_TTL_MS) localRoomPatches.delete(id);
  }
  for (const [id, at] of localRoomDeletions) {
    if (now - at > LOCAL_ROOM_PATCH_TTL_MS) localRoomDeletions.delete(id);
  }
}
function normRoomId(id) {
  return String(id ?? "").trim().toLowerCase();
}
function isLocallyDeleted(id) {
  const k = normRoomId(id);
  return Boolean(k) && localRoomDeletions.has(k);
}
function noteLocalRoomDeletion(id) {
  const sid = normRoomId(id);
  if (!sid) return;
  for (const key of [...localRoomPatches.keys()]) {
    if (normRoomId(key) === sid) localRoomPatches.delete(key);
  }
  localRoomDeletions.set(sid, Date.now());
}
function syncPendingLabelToRooms() {
  if (!pendingRoom) return;
  const label = roomLabelInput.value.trim();
  pendingRoom.label = label;
  if (!pendingRoom.editingId || !label) return;
  const i = rooms.findIndex((r) => normRoomId(r.id) === normRoomId(pendingRoom.editingId));
  if (i < 0) return;
  if (rooms[i].label === label) {
    noteLocalLabel(rooms[i].id, label);
    return;
  }
  const next = { ...rooms[i], label };
  rooms[i] = next;
  noteLocalRoomPatch(next);
}
function roomListDisplayLabel(r) {
  if (pendingRoom?.editingId && normRoomId(pendingRoom.editingId) === normRoomId(r.id)) {
    const live = (pendingRoom.label || roomLabelInput.value).trim();
    if (live) return live;
  }
  const override = localLabelOverrides.get(normRoomId(r.id));
  if (override) return override;
  return r.label || "(zonder label)";
}
function dropLocallyDeletedRooms(list) {
  if (!localRoomDeletions.size) return list;
  return list.filter((r) => !isLocallyDeleted(r.id));
}
function ringsApproxEqual(a, b) {
  if (!a?.length || !b?.length || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i].x - b[i].x) > 1e-9 || Math.abs(a[i].y - b[i].y) > 1e-9) return false;
  }
  return true;
}
function localPatchCaughtUp(server, p) {
  if (!ringsApproxEqual(server.points, p.points)) return false;
  if ((p.label || "") && (server.label || "") !== (p.label || "")) return false;
  if (p.vg_nr !== server.vg_nr) return false;
  if ((p.vr_nr || null) !== (server.vr_nr || null)) return false;
  const sSeal = readComponentSeal(server.analysis);
  const pSeal = readComponentSeal(p.analysis);
  const sOn = Boolean(sSeal?.enabled);
  const pOn = Boolean(pSeal?.enabled);
  if (sOn !== pOn) return false;
  if (pOn) {
    if ((sSeal?.material_id || "") !== (pSeal?.material_id || "")) return false;
    if ((sSeal?.catalog_id || "") !== (pSeal?.catalog_id || "")) return false;
  }
  const sOri = normalizeOrientatieCode(server.analysis?.orientatie || "");
  const pOri = normalizeOrientatieCode(p.analysis?.orientatie || "");
  if (sOri !== pOri) return false;
  const sMat = String(server.analysis?.material_id || "").trim();
  const pMat = String(p.analysis?.material_id || "").trim();
  if (sMat !== pMat) return false;
  const sCat = String(server.analysis?.catalog_id || "").trim();
  const pCat = String(p.analysis?.catalog_id || "").trim();
  if (sCat !== pCat) return false;
  return true;
}
function mergeAnalysisPreferPatch(server, patch) {
  if (!patch) return server;
  const merged = { ...server || {}, ...patch };
  if (Object.prototype.hasOwnProperty.call(patch, "seal") && !componentSealEnabled(patch)) {
    delete merged.seal;
  } else if (!Object.prototype.hasOwnProperty.call(patch, "seal") && componentSealEnabled(server)) {
    merged.seal = server.seal;
  }
  if (Array.isArray(patch.holes)) merged.holes = patch.holes;
  else if (server?.holes) merged.holes = server.holes;
  return merged;
}
function mergeRoomsWithLocalPatches(incoming) {
  pruneLocalRoomPatches();
  const visible = dropLocallyDeletedRooms(incoming);
  if (!localRoomPatches.size) return applyLocalLabelOverrides(visible);
  const now = Date.now();
  const out = visible.map((r) => {
    const p = localRoomPatches.get(r.id) || localRoomPatches.get(normRoomId(r.id));
    if (!p) return r;
    const age = now - p.at;
    if (localPatchCaughtUp(r, p)) {
      localRoomPatches.delete(normRoomId(r.id));
      return r;
    }
    const labelStillStale = Boolean((p.label || "").trim()) && (p.label || "").trim() !== (r.label || "").trim();
    if (age > LOCAL_ROOM_PATCH_TTL_MS && !labelStillStale) {
      localRoomPatches.delete(normRoomId(r.id));
      return r;
    }
    return {
      ...r,
      points: p.points.map((pt) => ({ ...pt })),
      label: p.label || r.label,
      level_hint: p.level_hint || r.level_hint,
      vg_nr: p.vg_nr,
      vr_nr: p.vr_nr,
      area_m2: r.area_m2 != null ? r.area_m2 : p.area_m2,
      area_norm: r.area_norm != null ? r.area_norm : p.area_norm,
      perimeter_m: r.perimeter_m != null ? r.perimeter_m : p.perimeter_m,
      metres_per_norm_unit: r.metres_per_norm_unit != null && r.metres_per_norm_unit > 0 ? r.metres_per_norm_unit : activeScaleMpu(),
      analysis: mergeAnalysisPreferPatch(r.analysis, p.analysis)
    };
  });
  const activeId = activeSection?.id || "";
  for (const [id, p] of localRoomPatches) {
    if (isLocallyDeleted(id)) continue;
    const touched = touchedRoomIds.has(normRoomId(id));
    if (now - p.at > LOCAL_ROOM_PATCH_READD_MS && !touched) {
      localRoomPatches.delete(normRoomId(id));
      continue;
    }
    if (out.some((r) => normRoomId(r.id) === normRoomId(id))) continue;
    if (!activeId) {
      localRoomPatches.delete(normRoomId(id));
      continue;
    }
    out.push({
      id,
      section_id: activeId,
      label: p.label,
      level_hint: p.level_hint,
      vg_nr: p.vg_nr,
      vr_nr: p.vr_nr,
      points: p.points.map((pt) => ({ ...pt })),
      area_m2: p.area_m2,
      area_norm: p.area_norm,
      perimeter_m: p.perimeter_m,
      perimeter_norm: null,
      metres_per_norm_unit: activeScaleMpu(),
      analysis_status: "ok",
      sort_order: out.length,
      analysis: p.analysis ?? null
    });
  }
  return applyLocalLabelOverrides(out);
}
var selectedSetIds = /* @__PURE__ */ new Set();
var constituentSigns = /* @__PURE__ */ new Map();
var booleanPreview = null;
var pendingDeleteId = null;
var pendingDeleteTimer = null;
var kierToggleInFlight = false;
var expandedComposeSourcePanels = /* @__PURE__ */ new Set();
var composeFlashTimer = null;
var materialCategoriesLoaded = false;
var materialCategoryMeta = [];
var catalogMaterials = [];
var favoriteMaterials = [];
var DEFAULT_KIER_CATALOG_ID = "D02408";
var KIER_RUBRIEK_NAME = MATERIAL_RUBRIEKEN.find((r) => r.nr === 9)?.name || "Kier- en naaddichtingsprofielen";
var kierMaterials = [];
var kierMaterialsLoaded = false;
var materialFilterTimer = null;
var linkedRooms = /* @__PURE__ */ new Map();
var TOUCHED_ROOMS_KEY = "app-gevelwering-touched-rooms";
var LABEL_OVERRIDES_KEY = "app-gevelwering-label-overrides";
var touchedRoomIds = loadTouchedRoomIds();
var localLabelOverrides = loadLabelOverrides();
function loadTouchedRoomIds() {
  try {
    const raw = sessionStorage.getItem(TOUCHED_ROOMS_KEY);
    if (!raw) return /* @__PURE__ */ new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return /* @__PURE__ */ new Set();
    return new Set(
      arr.filter((x) => typeof x === "string" && x.length > 0).map((x) => normRoomId(x)).filter(Boolean)
    );
  } catch {
    return /* @__PURE__ */ new Set();
  }
}
function persistTouchedRoomIds() {
  try {
    sessionStorage.setItem(TOUCHED_ROOMS_KEY, JSON.stringify([...touchedRoomIds]));
  } catch {
  }
}
function loadLabelOverrides() {
  try {
    const raw = sessionStorage.getItem(LABEL_OVERRIDES_KEY);
    if (!raw) return /* @__PURE__ */ new Map();
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return /* @__PURE__ */ new Map();
    const out = /* @__PURE__ */ new Map();
    for (const [k, v] of Object.entries(obj)) {
      const id = normRoomId(k);
      const label = typeof v === "string" ? v.trim() : "";
      if (id && label) out.set(id, label);
    }
    return out;
  } catch {
    return /* @__PURE__ */ new Map();
  }
}
function persistLabelOverrides() {
  try {
    sessionStorage.setItem(
      LABEL_OVERRIDES_KEY,
      JSON.stringify(Object.fromEntries(localLabelOverrides))
    );
  } catch {
  }
}
function noteLocalLabel(id, label) {
  const sid = normRoomId(id);
  const text = (label || "").trim();
  if (!sid || !text) return;
  if (localLabelOverrides.get(sid) === text) return;
  localLabelOverrides.set(sid, text);
  persistLabelOverrides();
}
function applyLocalLabelOverrides(list) {
  if (!localLabelOverrides.size) return list;
  let changed = false;
  const out = list.map((r) => {
    const sid = normRoomId(r.id);
    const want = localLabelOverrides.get(sid);
    if (!want) return r;
    if ((r.label || "").trim() === want) {
      localLabelOverrides.delete(sid);
      changed = true;
      return r;
    }
    return { ...r, label: want };
  });
  if (changed) persistLabelOverrides();
  return out;
}
function markRoomTouched(id) {
  const sid = normRoomId(id);
  if (!sid || touchedRoomIds.has(sid)) return;
  touchedRoomIds.add(sid);
  persistTouchedRoomIds();
}
var pdfDoc = null;
var cropBitmap = null;
var cropWidthPdfPts = 0;
var SECTION_THUMB_W = 128;
var SECTION_THUMB_H = 96;
var sectionThumbUrlCache = /* @__PURE__ */ new Map();
var pdfDocByDocumentId = /* @__PURE__ */ new Map();
var pdfDocLoadPromises = /* @__PURE__ */ new Map();
var thumbCacheBuildingId = "";
function ensurePdfjsWorker() {
  const pdfjsLib = window.pdfjsLib;
  if (!pdfjsLib) throw new Error("PDF.js not loaded");
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }
}
function clearSectionThumbnailCachesForBuilding(bid) {
  if (thumbCacheBuildingId === bid) return;
  sectionThumbUrlCache.clear();
  pdfDocByDocumentId.clear();
  pdfDocLoadPromises.clear();
  thumbCacheBuildingId = bid;
}
async function loadPdfDocumentCached(documentId) {
  ensurePdfjsWorker();
  const cached = pdfDocByDocumentId.get(documentId);
  if (cached) return cached;
  let pending = pdfDocLoadPromises.get(documentId);
  if (!pending) {
    pending = (async () => {
      const res = await fetch(`/api/drawings/download?document_id=${encodeURIComponent(documentId)}`, {
        credentials: "include",
        headers: apiAuthHeaders(auth().token)
      });
      if (!res.ok) throw new Error(`PDF laden mislukt (HTTP ${res.status})`);
      const buf = await res.arrayBuffer();
      const doc = await window.pdfjsLib.getDocument({ data: buf }).promise;
      pdfDocByDocumentId.set(documentId, doc);
      pdfDocLoadPromises.delete(documentId);
      return doc;
    })();
    pdfDocLoadPromises.set(documentId, pending);
  }
  return pending;
}
async function sectionThumbnailDataUrl(sec) {
  const hit = sectionThumbUrlCache.get(sec.id);
  if (hit) return hit;
  if (!auth()?.token) return null;
  try {
    const pdf = await loadPdfDocumentCached(sec.document_id);
    const pageNum = Math.min(pdf.numPages, Math.max(1, sec.page_index + 1));
    const page = await pdf.getPage(pageNum);
    const pageRotate = typeof page.rotate === "number" ? page.rotate : 0;
    const viewRotate = Number(sec.view_rotate) || 0;
    const rotation = (pageRotate + viewRotate) % 360;
    const baseVp = page.getViewport({ scale: 1, rotation });
    const cropWNorm = Math.max(1e-3, sec.x_max - sec.x_min);
    const cropPxW = cropWNorm * baseVp.width;
    const renderScale = Math.min(2.5, Math.max(1, SECTION_THUMB_W * 2 / cropPxW));
    const viewport = page.getViewport({ scale: renderScale, rotation });
    const off = document.createElement("canvas");
    off.width = Math.floor(viewport.width);
    off.height = Math.floor(viewport.height);
    const octx = off.getContext("2d");
    if (!octx) return null;
    octx.setTransform(1, 0, 0, 1, 0, 0);
    await page.render({ canvasContext: octx, viewport }).promise;
    const x0 = Math.floor(sec.x_min * off.width);
    const y0 = Math.floor(sec.y_min * off.height);
    const x1 = Math.ceil(sec.x_max * off.width);
    const y1 = Math.ceil(sec.y_max * off.height);
    const cw = Math.max(1, x1 - x0);
    const ch = Math.max(1, y1 - y0);
    const thumb = document.createElement("canvas");
    thumb.width = SECTION_THUMB_W;
    thumb.height = SECTION_THUMB_H;
    const tctx = thumb.getContext("2d");
    if (!tctx) return null;
    tctx.fillStyle = "#fff";
    tctx.fillRect(0, 0, SECTION_THUMB_W, SECTION_THUMB_H);
    const fit = Math.min(SECTION_THUMB_W / cw, SECTION_THUMB_H / ch);
    const dw = cw * fit;
    const dh = ch * fit;
    tctx.drawImage(off, x0, y0, cw, ch, (SECTION_THUMB_W - dw) / 2, (SECTION_THUMB_H - dh) / 2, dw, dh);
    const dataUrl = thumb.toDataURL("image/jpeg", 0.82);
    sectionThumbUrlCache.set(sec.id, dataUrl);
    return dataUrl;
  } catch (err) {
    console.warn("section thumbnail failed", sec.id, err);
    return null;
  }
}
function mountSectionThumbnail(sec, img) {
  const cached = sectionThumbUrlCache.get(sec.id);
  if (cached) {
    img.src = cached;
    img.classList.remove("is-loading");
    return;
  }
  void sectionThumbnailDataUrl(sec).then((url) => {
    if (!img.isConnected) return;
    if (!url) {
      img.classList.remove("is-loading");
      img.classList.add("is-error");
      img.alt = "Voorbeeld niet beschikbaar";
      return;
    }
    img.src = url;
    img.classList.remove("is-loading");
  });
}
var canvasWidth = 0;
var canvasHeight = 0;
var ZOOM_MIN = 0.5;
var ZOOM_MAX = 4;
var ZOOM_MAX_DETAIL = 8;
var ZOOM_STEP = 0.1;
var ZOOM_STORAGE_KEY = "app-gevelwering-floormap-view-zoom";
var DETAIL_FACTOR_DEFAULT = 1;
function loadStoredViewZoom() {
  try {
    const raw = Number(localStorage.getItem(ZOOM_STORAGE_KEY));
    if (!Number.isFinite(raw) || raw <= 0) return 1;
    return Math.min(ZOOM_MAX_DETAIL, Math.max(ZOOM_MIN, Math.round(raw * 100) / 100));
  } catch {
    return 1;
  }
}
function persistViewZoom(z) {
  try {
    localStorage.setItem(ZOOM_STORAGE_KEY, String(z));
  } catch {
  }
}
var viewZoom = loadStoredViewZoom();
var discovery = null;
var calibrate = null;
var detail = null;
var detailPick = null;
var measure = { tool: "off", points: [], cursor: null };
var pendingRoom = null;
function setStatus(text, kind = "busy") {
  connStatusEl.textContent = text;
  connBarEl.classList.remove("ok", "err", "busy", "status");
  connBarEl.classList.add("status", kind);
}
function setConnLed(connected) {
  connLedEl.classList.toggle("connected", connected);
  connLedEl.classList.toggle("disconnected", !connected);
}
function showLogin() {
  loginPanelEl.classList.remove("hidden");
  panelEl.classList.add("hidden");
  if (fileMenuRoot) fileMenuRoot.hidden = true;
  projectMenu?.setEnabled(false);
}
function showPanel(info) {
  loginPanelEl.classList.add("hidden");
  panelEl.classList.remove("hidden");
  userLabelEl.textContent = `Ingelogd als ${info.display_name || info.username}`;
  if (fileMenuRoot) fileMenuRoot.hidden = false;
  projectMenu?.setEnabled(true);
  projectMenu?.refreshTitle();
}
var session = new BppSession({
  wsUrl: resolveBppWsUrl(),
  authKey: AUTH_KEY,
  clientName: "app-gevelwering-floormap",
  callbacks: {
    onStatus: setStatus,
    onConnLed: setConnLed,
    onLogin: (info) => showPanel(info),
    onLogout: () => showLogin(),
    onReady: async () => {
      if (session.auth) {
        buildingInput.value = buildingId;
        if (buildingId) await loadFloormapSections(buildingId);
      }
    }
  }
});
function invokeString(target, args) {
  return session.invokeString(target, args);
}
function auth() {
  return session.auth;
}
async function refreshBuildingMeta() {
  if (!auth()?.token || !buildingId) {
    buildingLabel = "";
    buildingExternalRef = "";
    return;
  }
  try {
    const ret = await invokeString("API_EngineerGetProject", [auth().token, buildingId]);
    if (ret.startsWith("ERROR")) return;
    const data = JSON.parse(ret);
    buildingLabel = data.label || "";
    buildingExternalRef = data.external_ref || "";
  } catch {
  }
}
function authHeaders() {
  return apiAuthHeaders(auth().token, true);
}
async function apiGet(url) {
  const res = await fetch(url, {
    credentials: "include",
    headers: apiAuthHeaders(auth().token)
  });
  const body = await res.json();
  if (!res.ok || body.ok === false) {
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return body;
}
async function readJsonResponse(res) {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(`HTTP ${res.status}: lege response (herstart Node serve.mjs?)`);
  }
  try {
    return JSON.parse(text);
  } catch {
    const snippet = text.replace(/\s+/g, " ").slice(0, 120);
    throw new Error(`HTTP ${res.status}: geen JSON (${snippet})`);
  }
}
async function apiPost(url, payload, opts) {
  const timeoutMs = opts?.timeoutMs ?? 0;
  const signal = timeoutMs > 0 && typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? AbortSignal.timeout(timeoutMs) : void 0;
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: authHeaders(),
      body: JSON.stringify(payload),
      signal
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (err instanceof TypeError || /networkerror|failed to fetch|load failed|network request failed/i.test(msg)) {
      throw new Error(
        "Node-server niet bereikbaar (poort 4173) \u2014 herstart ./start.sh en controleer of serve.mjs draait"
      );
    }
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new Error("Server discover-time-out (>3 min) \u2014 PDF render duurt te lang");
    }
    throw err;
  }
  const body = await readJsonResponse(res);
  if (!res.ok || body.ok === false) {
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return body;
}
async function apiDelete(url) {
  const res = await fetch(url, {
    method: "DELETE",
    credentials: "include",
    headers: apiAuthHeaders(auth().token)
  });
  const body = await res.json();
  if (!res.ok || body.ok === false) {
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return body;
}
function updateScaleUi() {
  const n = activePartNoun();
  if (!activeSection) {
    scaleStatusEl.textContent = "Niet gezet";
    calibrateHintEl.textContent = "Klik op Schaal kalibreren wanneer u klaar bent.";
    if (roomsHintEl) roomsHintEl.textContent = `Zet de tekeningsschaal om ${n.singular}-oppervlakten in m\xB2 te krijgen.`;
    setCalibrateLed(false);
    return;
  }
  const mpu = activeSection.metres_per_norm_unit;
  const ratio = activeSection.scale_ratio;
  const src = (activeSection.scale_source || "NONE").toUpperCase();
  if (mpu != null && mpu > 0) {
    if (ratio != null && ratio > 0) {
      const from = src === "PDF_TEXT" ? " (uit tekeningtekst)" : src === "CALIBRATED" ? " (gekalibreerd)" : "";
      scaleStatusEl.textContent = `Papierschaal 1:${ratio}${from}`;
    } else {
      scaleStatusEl.textContent = src === "CALIBRATED" ? "Schaal gezet via gemarkeerde lengte" : `Schaal gezet \u2014 ${n.singular}-maten in m\xB2 / m`;
    }
    calibrateHintEl.textContent = `Schaal is klaar. Gebruik Lengte om een afstand te controleren, of Teken ${n.singular} \u2014 omtrek/oppervlakte volgen uit de polygoon.`;
    if (roomsHintEl) {
      roomsHintEl.textContent = `Oppervlakte (m\xB2) en omtrek (m) van de ${n.singular} gebruiken deze schaal.`;
    }
    calibrateBtn.textContent = "Schaal opnieuw kalibreren";
    setCalibrateLed(true, src === "PDF_TEXT" ? "Schaal gezet (uit tekeningtekst)" : "Kalibratie uitgevoerd");
  } else {
    scaleStatusEl.textContent = "Niet gezet \u2014 markeer een bekende lengte, of gebruik gedetecteerde 1:N";
    calibrateHintEl.textContent = "Klik Schaal kalibreren, markeer twee punten, en voer die lengte in mm in.";
    if (roomsHintEl) roomsHintEl.textContent = "Zonder schaal worden alleen relatieve maten getoond.";
    calibrateBtn.textContent = "Schaal kalibreren";
    setCalibrateLed(false);
  }
  updateToolHint();
}
function setCalibrateLed(on, titleWhenOn = "Kalibratie uitgevoerd") {
  if (!calibrateLedEl) return;
  calibrateLedEl.classList.toggle("is-on", on);
  calibrateLedEl.title = on ? titleWhenOn : "Schaal niet gezet";
  calibrateLedEl.setAttribute("aria-label", on ? titleWhenOn : "Schaal niet gezet");
}
function activeScaleMpu() {
  const mpu = activeSection?.metres_per_norm_unit;
  if (mpu == null || !(mpu > 0)) return null;
  return mpu;
}
function activeScaleAspect() {
  if (canvasWidth > 0 && canvasHeight > 0) {
    return canvasHeight / canvasWidth;
  }
  return normalizeAspectYx(activeSection?.scale_aspect_yx);
}
function fmtMeasure(n, digits = 1) {
  if (n == null || !Number.isFinite(n)) return "\u2014";
  return n.toFixed(digits);
}
function pathLengthM(pts, mpu, closed) {
  return Math.round(scaledPathLength(pts, mpu, activeScaleAspect(), closed) * 100) / 100;
}
function pathAreaM2(pts, mpu) {
  return Math.round(scaledAreaM2(shoelaceArea(pts), mpu, activeScaleAspect()) * 100) / 100;
}
function measureDisplayPoints() {
  const pts = measure.points.slice();
  if (measure.cursor && measure.tool === "length" && pts.length === 1) {
    pts.push(measure.cursor);
  }
  return pts;
}
function pendingDrawDisplayPoints() {
  if (!pendingRoom?.drawing || pendingRoom.closed) return null;
  if (!pendingRoom.points.length) return null;
  const pts = pendingRoom.points.map((p) => ({ ...p }));
  if (pendingRoom.drawCursor) pts.push({ ...pendingRoom.drawCursor });
  return pts;
}
function ringForMetrics() {
  if (pendingRoom?.closed && pendingRoom.points.length >= 2) {
    return { pts: pendingRoom.points, closed: true };
  }
  const drawing = pendingDrawDisplayPoints();
  if (drawing && drawing.length >= 2) {
    return { pts: drawing, closed: false };
  }
  if (pendingRoom && pendingRoom.points.length >= 2) {
    return { pts: pendingRoom.points, closed: pendingRoom.closed };
  }
  if (discovery?.current && discovery.current.length >= 2) {
    return { pts: discovery.current, closed: true };
  }
  return null;
}
function updateMeasureReadouts() {
  const mpu = activeScaleMpu();
  if (!mpu) {
    toolLengthMmEl.value = "\u2014";
    toolCircMmEl.value = "\u2014";
    toolAreaMm2El.value = "\u2014";
    return;
  }
  if (measure.tool === "length") {
    const display = measureDisplayPoints();
    toolLengthMmEl.value = display.length >= 2 ? fmtMeasure(pathLengthM(display.slice(0, 2), mpu, false), 2) : "\u2014";
  } else if (pendingRoom?.drawing && !pendingRoom.closed) {
    const pts = pendingDrawDisplayPoints();
    if (pts && pts.length >= 2) {
      const a = pts[pts.length - 2];
      const b = pts[pts.length - 1];
      toolLengthMmEl.value = fmtMeasure(pathLengthM([a, b], mpu, false), 2);
    } else {
      toolLengthMmEl.value = "\u2014";
    }
  } else {
    toolLengthMmEl.value = "\u2014";
  }
  const ring = ringForMetrics();
  if (ring) {
    toolCircMmEl.value = fmtMeasure(pathLengthM(ring.pts, mpu, ring.closed), 2);
    toolAreaMm2El.value = ring.closed && ring.pts.length >= 3 ? fmtMeasure(pathAreaM2(ring.pts, mpu), 2) : "\u2014";
  } else {
    toolCircMmEl.value = "\u2014";
    toolAreaMm2El.value = "\u2014";
  }
}
function updateToolHint() {
  if (!toolHintEl) return;
  const n = activePartNoun();
  if (!activeScaleMpu()) {
    toolHintEl.textContent = `Zet eerst de schaal, meet daarna een lengte of teken een ${n.singular}.`;
    return;
  }
  if (pendingRoom?.drawing && !pendingRoom.closed) {
    toolHintEl.textContent = pendingRoom.points.length === 0 ? `Klik hoeken van de ${n.singular}. Lengte toont het actieve segment; omtrek loopt mee.` : `${pendingRoom.points.length} hoekpunt(en). Lengte = huidig segment; sluit bij het startkruis (groen) voor oppervlakte.`;
    return;
  }
  if (pendingRoom?.closed) {
    toolHintEl.textContent = `Polygoon van ${n.singular} klaar \u2014 omtrek/oppervlakte getoond. Sleep hoeken of sla ${n.singular} op.`;
    return;
  }
  if (measure.tool === "length") {
    toolHintEl.textContent = measure.points.length < 2 ? "Klik twee punten om lengte te meten (live bij bewegen)." : "Lengte klaar. Wissen of opnieuw klikken om opnieuw te beginnen.";
    return;
  }
  toolHintEl.textContent = `Kies Lengte of Teken ${n.singular}. Omtrek en oppervlakte komen uit de polygoon.`;
}
function activeToolMode() {
  if (pendingRoom?.drawing || pendingRoom?.closed) return "room";
  if (measure.tool === "length") return "length";
  return "off";
}
function syncToolButtons() {
  const mode = activeToolMode();
  const n = activePartNoun();
  document.querySelectorAll(".tool-mode-btn").forEach((btn) => {
    btn.classList.toggle("active", (btn.dataset.tool || "off") === mode);
    if (btn.dataset.tool === "room") btn.textContent = `Teken ${n.singular}`;
  });
}
function clearMeasure(keepTool = true) {
  measure = {
    tool: keepTool ? measure.tool : "off",
    points: [],
    cursor: null
  };
  if (!keepTool) syncToolButtons();
  updateMeasureReadouts();
  updateToolHint();
  drawOverlay();
}
function setMeasureTool(tool) {
  if (tool === "room") {
    if (pendingRoom?.drawing) {
      syncToolButtons();
      updateToolHint();
      return;
    }
    beginDrawRoom();
    return;
  }
  if (tool !== "off") {
    if (calibrate) endCalibrate();
    if (discovery) {
      setStatus("Rond ontdekken eerst af of annuleer voordat u meet", "err");
      syncToolButtons();
      return;
    }
    if (!activeScaleMpu()) {
      setStatus("Zet eerst de schaal", "err");
      measure.tool = "off";
      syncToolButtons();
      updateToolHint();
      return;
    }
  }
  if (pendingRoom) clearPendingRoom();
  measure = { tool: tool === "length" ? "length" : "off", points: [], cursor: null };
  syncToolButtons();
  updateMeasureReadouts();
  updateToolHint();
  drawOverlay();
  if (tool === "length") setStatus("Lengte meten: klik twee punten", "busy");
}
function sectionKindOrder(kind) {
  switch (String(kind || "").toUpperCase()) {
    case "FLOORMAP":
      return 0;
    case "FACADE":
      return 1;
    case "SECTION":
      return 2;
    case "CROSS_SECTION":
      return 3;
    default:
      return 9;
  }
}
function dominantLevelHint(roomsList, sectionLabel) {
  const counts = /* @__PURE__ */ new Map();
  for (const r of roomsList) {
    const h = String(r.level_hint || "").toUpperCase();
    if (!h || h === "OTHER") continue;
    counts.set(h, (counts.get(h) || 0) + 1);
  }
  let best = "";
  let bestN = 0;
  for (const [h, n] of counts) {
    if (n > bestN) {
      best = h;
      bestN = n;
    }
  }
  if (best) return best;
  return inferLevelHintFromLabel(sectionLabel) || "OTHER";
}
function compareVrForOverview(a, b) {
  try {
    return compareVrNr(a, b);
  } catch {
    return a.localeCompare(b, "nl", { numeric: true, sensitivity: "base" });
  }
}
var lastVgVrOverviewFloors = [];
function vgVrOverviewSummaryText(floors) {
  const nVr = floors.reduce((sum, f) => sum + f.rooms.length, 0);
  const vgSet = /* @__PURE__ */ new Set();
  for (const f of floors) {
    for (const r of f.rooms) vgSet.add(r.vg);
  }
  const nVg = vgSet.size;
  const vrLabel = nVr === 1 ? "toegekende verblijfsruimte" : "toegekende verblijfsruimten";
  const vgLabel = nVg === 1 ? "verblijfsgebied" : "verblijfsgebieden";
  return `${nVr} ${vrLabel} in ${nVg} ${vgLabel}.`;
}
function formatVgVrOverviewClipboard(floors) {
  const title = buildingLabel || buildingExternalRef || buildingId || "Project";
  const lines = [`VG/VR \u2014 ${title}`, vgVrOverviewSummaryText(floors), ""];
  const withRooms = floors.filter((f) => f.rooms.length > 0);
  const empty = floors.filter((f) => f.rooms.length === 0);
  if (!withRooms.length) {
    lines.push(floors.length ? "Nog geen VG/VR toegekend op plattegronden." : "Geen plattegronden in dit project.");
    return lines.join("\n").trimEnd() + "\n";
  }
  for (const floor of withRooms) {
    lines.push(`${levelLabel(floor.levelHint)} \u2014 ${floor.sectionLabel}`);
    lines.push("VG	VR	Ruimte");
    for (const r of floor.rooms) {
      lines.push(`${r.vg}	${r.vr}	${r.label}`);
    }
    lines.push("");
  }
  if (empty.length) {
    lines.push("Zonder VG/VR");
    for (const floor of empty) {
      lines.push(`- ${levelLabel(floor.levelHint)} \u2014 ${floor.sectionLabel}`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd() + "\n";
}
async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  ta.remove();
  if (!ok) throw new Error("Clipboard niet beschikbaar");
}
async function copyVgVrOverviewToClipboard() {
  if (!lastVgVrOverviewFloors.length && !sections.some((s) => isFloormapKind(s.region_kind))) {
    setStatus("Geen VG/VR-overzicht om te kopi\xEBren", "err");
    return;
  }
  try {
    await copyTextToClipboard(formatVgVrOverviewClipboard(lastVgVrOverviewFloors));
    setStatus("VG/VR-overzicht gekopieerd naar clipboard", "ok");
    if (vgVrOverviewCopyBtn) {
      const prev = vgVrOverviewCopyBtn.textContent;
      vgVrOverviewCopyBtn.textContent = "Gekopieerd";
      window.setTimeout(() => {
        if (vgVrOverviewCopyBtn) vgVrOverviewCopyBtn.textContent = prev || "Naar clipboard";
      }, 1400);
    }
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  }
}
async function buildVgVrOverview() {
  const floors = [];
  for (const s of sections) {
    if (!isFloormapKind(s.region_kind)) continue;
    const list = await listSectionRoomsForOverview(s.id);
    const assigned = [];
    for (const r of list) {
      if (r.vg_nr == null || !normalizeVrNr(r.vr_nr)) continue;
      if (componentIsLengthQuantity(r) || isComposeResultRoom(r)) continue;
      assigned.push({
        vg: Number(r.vg_nr),
        vr: normalizeVrNr(r.vr_nr),
        label: (r.label || "").trim() || "\u2014"
      });
    }
    assigned.sort(
      (a, b) => a.vg - b.vg || compareVrForOverview(a.vr, b.vr) || a.label.localeCompare(b.label, "nl")
    );
    floors.push({
      sectionId: s.id,
      sectionLabel: s.label || "Plattegrond",
      levelHint: dominantLevelHint(list, s.label || ""),
      pageIndex: s.page_index,
      rooms: assigned
    });
  }
  floors.sort(
    (a, b) => levelSortRank(a.levelHint) - levelSortRank(b.levelHint) || a.pageIndex - b.pageIndex || a.sectionLabel.localeCompare(b.sectionLabel, "nl")
  );
  return floors;
}
function renderVgVrOverviewBody(floors) {
  if (!vgVrOverviewBodyEl) return;
  vgVrOverviewBodyEl.replaceChildren();
  const withRooms = floors.filter((f) => f.rooms.length > 0);
  const empty = floors.filter((f) => f.rooms.length === 0);
  if (!withRooms.length && !empty.length) {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = "Geen plattegronden in dit project.";
    vgVrOverviewBodyEl.appendChild(p);
    return;
  }
  if (!withRooms.length) {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = "Nog geen VG/VR toegekend op plattegronden.";
    vgVrOverviewBodyEl.appendChild(p);
  }
  for (const floor of withRooms) {
    const block = document.createElement("section");
    block.className = "fm-vgvr-floor";
    const h = document.createElement("h3");
    h.textContent = `${levelLabel(floor.levelHint)} \u2014 ${floor.sectionLabel}`;
    block.appendChild(h);
    const meta = document.createElement("p");
    meta.className = "hint";
    meta.textContent = `${floor.rooms.length} ruimte(n) met VG/VR \xB7 pagina ${floor.pageIndex + 1}`;
    block.appendChild(meta);
    const table = document.createElement("table");
    table.className = "fm-vgvr-table";
    table.innerHTML = "<thead><tr><th>VG</th><th>VR</th><th>Ruimte</th></tr></thead>";
    const tbody = document.createElement("tbody");
    for (const r of floor.rooms) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${r.vg}</td><td>${r.vr}</td><td></td>`;
      const tdLabel = tr.cells[2];
      tdLabel.textContent = r.label;
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    block.appendChild(table);
    vgVrOverviewBodyEl.appendChild(block);
  }
  if (empty.length) {
    const block = document.createElement("section");
    block.className = "fm-vgvr-floor";
    const h = document.createElement("h3");
    h.textContent = "Zonder VG/VR";
    block.appendChild(h);
    const ul = document.createElement("ul");
    ul.className = "hint";
    ul.style.margin = "0";
    ul.style.paddingLeft = "1.1rem";
    for (const floor of empty) {
      const li = document.createElement("li");
      li.textContent = `${levelLabel(floor.levelHint)} \u2014 ${floor.sectionLabel}`;
      ul.appendChild(li);
    }
    block.appendChild(ul);
    vgVrOverviewBodyEl.appendChild(block);
  }
}
async function openVgVrOverview() {
  if (!vgVrOverviewDialog || !auth()?.token) {
    setStatus("Open eerst een project", "err");
    return;
  }
  if (!sections.some((s) => isFloormapKind(s.region_kind))) {
    setStatus("Geen plattegronden in dit project", "err");
    return;
  }
  if (vgVrOverviewBtn) vgVrOverviewBtn.disabled = true;
  setStatus("VG/VR-overzicht laden\u2026", "busy");
  try {
    const floors = await buildVgVrOverview();
    lastVgVrOverviewFloors = floors;
    const title = buildingLabel || buildingExternalRef || buildingId || "Project";
    if (vgVrOverviewTitleEl) vgVrOverviewTitleEl.textContent = `VG/VR \u2014 ${title}`;
    if (vgVrOverviewMetaEl) {
      vgVrOverviewMetaEl.textContent = vgVrOverviewSummaryText(floors);
    }
    if (vgVrOverviewCopyBtn) {
      vgVrOverviewCopyBtn.disabled = floors.every((f) => f.rooms.length === 0);
    }
    renderVgVrOverviewBody(floors);
    if (!vgVrOverviewDialog.open) vgVrOverviewDialog.showModal();
    setStatus("VG/VR-overzicht klaar", "ok");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  } finally {
    if (vgVrOverviewBtn) vgVrOverviewBtn.disabled = false;
  }
}
function renderSectionList() {
  sectionListEl.innerHTML = "";
  sectionListEl.className = "fm-section-picker";
  if (vgVrOverviewBtn) {
    vgVrOverviewBtn.disabled = !sections.some((s) => isFloormapKind(s.region_kind));
  }
  if (sections.length === 0) {
    sectionListEl.innerHTML = `<p class="hint">Geen schaalbare secties (plattegrond / gevel / doorsnede) voor dit project.</p>`;
    return;
  }
  const byKind = /* @__PURE__ */ new Map();
  for (const s of sections) {
    const kind = String(s.region_kind || "FLOORMAP").toUpperCase();
    const list = byKind.get(kind) || [];
    list.push(s);
    byKind.set(kind, list);
  }
  const kinds = [...byKind.keys()].sort((a, b) => sectionKindOrder(a) - sectionKindOrder(b) || a.localeCompare(b));
  for (const kind of kinds) {
    const group = byKind.get(kind) || [];
    const n = partNoun(kind);
    const row = document.createElement("section");
    row.className = "fm-section-type-row";
    row.setAttribute("aria-label", n.kindLabel);
    const head = document.createElement("h3");
    head.className = "fm-section-type-heading";
    head.textContent = `${n.kindLabel}${group.length > 1 ? ` (${group.length})` : ""}`;
    row.appendChild(head);
    const grid = document.createElement("div");
    grid.className = "fm-section-type-grid";
    for (const s of group) {
      const card = document.createElement("article");
      card.className = "fm-section-card panel";
      const hasComponents = (s.room_count || 0) >= 1;
      const scale = s.metres_per_norm_unit != null && s.metres_per_norm_unit > 0 ? `schaal gezet (${s.scale_source})` : "geen schaal";
      const countLabel = s.room_count === 1 ? `1 ${n.singular}` : `${s.room_count} ${n.plural}`;
      const title = document.createElement("h4");
      title.textContent = s.label || n.title;
      card.appendChild(title);
      const meta = document.createElement("p");
      meta.className = "hint";
      meta.textContent = `pagina ${s.page_index + 1} \xB7 ${countLabel} \xB7 ${scale}`;
      card.appendChild(meta);
      const media = document.createElement("div");
      media.className = "fm-section-card-media";
      const thumb = document.createElement("img");
      thumb.className = "section-thumb is-loading";
      thumb.alt = s.label || n.title;
      thumb.width = SECTION_THUMB_W;
      thumb.height = SECTION_THUMB_H;
      media.appendChild(thumb);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = hasComponents ? "section-open-btn section-open-btn--filled" : "section-open-btn section-open-btn--empty";
      btn.textContent = `${n.title} openen`;
      btn.addEventListener("click", () => {
        void openSection(s.id);
      });
      media.appendChild(btn);
      card.appendChild(media);
      grid.appendChild(card);
      mountSectionThumbnail(s, thumb);
    }
    row.appendChild(grid);
    sectionListEl.appendChild(row);
  }
}
function selectedIsKierdichting() {
  const mat = selectedCatalogMaterial();
  if (!mat) return false;
  return isLengthQuantityRubriek(mat.rubriek_nr ?? mat.master_category);
}
function pendingIsLengthComponent() {
  if (pendingRoom?.editingId) {
    const editing = rooms.find((x) => x.id === pendingRoom.editingId);
    if (editing) return componentIsLengthQuantity(editing);
  }
  if (selectedIsKierdichting()) return true;
  return false;
}
function pendingSaveIsLength() {
  return pendingIsLengthComponent() || !pendingRoom?.editingId && selectedIsKierdichting();
}
function perimeterMOfRing(points) {
  const mpu = activeScaleMpu();
  if (!mpu || !points || points.length < 2) return null;
  const ring = points.length >= 3 ? closeRing(points) : points;
  return Math.round(scaledPathLength(ring, mpu, activeScaleAspect(), ring.length >= 3) * 100) / 100;
}
function existingSealFor(parentId) {
  if (!parentId) return void 0;
  return rooms.find((r) => (r.analysis?.seal_for_subsection_id || "") === parentId);
}
function componentHasSeal(r) {
  if (componentSealEnabled(r.analysis)) return true;
  return Boolean(existingSealFor(r.id));
}
function renderKierMaterialOptions(selectedId) {
  if (!kierSuggestMatEl) return;
  const keep = selectedId ?? kierSuggestMatEl.value;
  kierSuggestMatEl.replaceChildren();
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = kierMaterials.length ? `\u2014 ${DEFAULT_KIER_CATALOG_ID} (standaard) \u2014` : `\u2014 ${DEFAULT_KIER_CATALOG_ID} \u2014`;
  kierSuggestMatEl.appendChild(ph);
  const sorted = [...kierMaterials].sort((a, b) => {
    const aDef = (a.catalog_id || "") === DEFAULT_KIER_CATALOG_ID ? 0 : 1;
    const bDef = (b.catalog_id || "") === DEFAULT_KIER_CATALOG_ID ? 0 : 1;
    if (aDef !== bDef) return aDef - bDef;
    return (a.catalog_id || a.name).localeCompare(b.catalog_id || b.name, "nl");
  });
  for (const m of sorted) {
    const opt = document.createElement("option");
    opt.value = m.material_id;
    const code = (m.catalog_id || "").trim();
    const ra = m.ra_dba != null ? ` \xB7 RA ${m.ra_dba}` : "";
    opt.textContent = code ? `${code} \xB7 ${m.name}${ra}` : `${m.name}${ra}`;
    kierSuggestMatEl.appendChild(opt);
  }
  const def = kierMaterials.find((m) => (m.catalog_id || "") === DEFAULT_KIER_CATALOG_ID);
  if (keep && kierMaterials.some((m) => m.material_id === keep)) {
    kierSuggestMatEl.value = keep;
  } else if (def) {
    kierSuggestMatEl.value = def.material_id;
  } else {
    kierSuggestMatEl.value = "";
  }
}
async function ensureKierMaterials() {
  if (!auth()?.token || kierMaterialsLoaded) {
    renderKierMaterialOptions();
    return;
  }
  try {
    const data = bppPhase1Enabled() ? await bppListMaterials(invokeString, auth().token, {
      master_category: KIER_RUBRIEK_NAME,
      limit: 1e3
    }) : await apiGet(
      `/api/floormap/materials?master_category=${encodeURIComponent(KIER_RUBRIEK_NAME)}&limit=1000`
    );
    kierMaterials = data.materials || [];
    if (!kierMaterials.some((m) => (m.catalog_id || "") === DEFAULT_KIER_CATALOG_ID)) {
      const extra = bppPhase1Enabled() ? await bppListMaterials(invokeString, auth().token, {
        q: DEFAULT_KIER_CATALOG_ID,
        limit: 20
      }) : await apiGet(
        `/api/floormap/materials?q=${encodeURIComponent(DEFAULT_KIER_CATALOG_ID)}&limit=20`
      );
      for (const m of extra.materials || []) {
        if ((m.catalog_id || "") === DEFAULT_KIER_CATALOG_ID) {
          kierMaterials = [m, ...kierMaterials];
          break;
        }
      }
    }
    kierMaterialsLoaded = true;
  } catch (err) {
    console.warn("kier materials load failed", err);
    kierMaterials = [];
  }
  renderKierMaterialOptions();
}
function resolveKierSuggestMaterial(preferredId) {
  const id = (preferredId || kierSuggestMatEl?.value || "").trim();
  if (id) return kierMaterials.find((m) => m.material_id === id) || null;
  return kierMaterials.find((m) => (m.catalog_id || "") === DEFAULT_KIER_CATALOG_ID) || kierMaterials[0] || null;
}
function sealMaterialKey(a) {
  if (!a) return "";
  if ((a.material_id || "").trim()) return `id:${a.material_id.trim()}`;
  if ((a.catalog_id || "").trim()) return `cat:${a.catalog_id.trim().toUpperCase()}`;
  return "";
}
function sumSealLengthsForType(materialKey) {
  if (!materialKey) return 0;
  let sum = 0;
  for (const r of rooms) {
    if (isLegacySealSibling(r.analysis)) {
      if (sealMaterialKey(r.analysis) !== materialKey) continue;
      if (r.analysis?.length_m != null && Number.isFinite(r.analysis.length_m)) {
        sum += Number(r.analysis.length_m);
      }
      continue;
    }
    const seal = readComponentSeal(r.analysis);
    if (!seal?.enabled) continue;
    if (sealMaterialKeyFromSeal(seal) !== materialKey) continue;
    const live = pendingRoom?.editingId === r.id ? pendingRoom : null;
    const pts = live ? live.points : r.points;
    const mpu = r.metres_per_norm_unit != null && r.metres_per_norm_unit > 0 ? r.metres_per_norm_unit : activeScaleMpu();
    if (pts?.length >= 3 && mpu) {
      sum += scaledPathLength(pts, mpu, activeScaleAspect(), true);
    } else if (seal.length_m != null && Number.isFinite(seal.length_m)) {
      sum += Number(seal.length_m);
    }
  }
  return Math.round(sum * 100) / 100;
}
function syncKierSuggestUi() {
  if (!kierSuggestEl) return;
  const editing = pendingRoom?.editingId ? rooms.find((r) => r.id === pendingRoom.editingId) : void 0;
  const closedArea = Boolean(pendingRoom?.closed && pendingRoom.points.length >= 3) && !selectedIsKierdichting() && !(editing && componentIsLengthQuantity(editing)) && !(editing && isLegacySealSibling(editing.analysis));
  const show = !isFloormapKind() && closedArea;
  kierSuggestEl.classList.toggle("hidden", !show);
  if (!show) return;
  void ensureKierMaterials();
  const peri = pendingRoom ? perimeterMOfRing(pendingRoom.points) : null;
  const hasSeal = editing ? componentHasSeal(editing) : false;
  const sealAttr = editing ? readComponentSeal(editing.analysis) : null;
  const setSelected = Boolean(editing && selectedSetIds.has(editing.id));
  const canToggle = Boolean(
    editing && (setSelected || pendingRoom?.editingId === editing.id) || !editing && pendingRoom?.closed && (pendingRoom.points.length || 0) >= 3
  );
  const pendingIntent = Boolean(kierSuggestCb?.dataset.userTouched === "1" && !editing && kierSuggestCb?.checked);
  if (kierSuggestCb && !kierToggleInFlight) {
    if (!pendingIntent) {
      kierSuggestCb.checked = hasSeal;
      delete kierSuggestCb.dataset.userTouched;
    }
    kierSuggestCb.disabled = !canToggle && !hasSeal && !pendingIntent;
    kierSuggestCb.title = canToggle ? editing ? "Kierdichting (omtrek) voor dit component \u2014 meestal op een samengesteld \xB1-resultaat" : "Kierdichting (omtrek) \u2014 wordt bij Opslaan op dit nieuwe vlak gezet" : hasSeal ? "Uitvinken zet kierdichting uit" : "Open of selecteer het component om kierdichting aan/uit te zetten";
    const mid = sealAttr?.material_id || existingSealFor(editing?.id || "")?.analysis?.material_id;
    if (mid) renderKierMaterialOptions(mid);
  }
  if (kierSuggestHintEl) {
    const periBit = peri != null ? ` Omtrek \u2248 ${peri.toFixed(2)} m.` : " Zet eerst de schaal voor een omtrek in meters.";
    const mat = resolveKierSuggestMaterial(sealAttr?.material_id);
    const key = mat ? sealMaterialKey({
      material_id: mat.material_id,
      catalog_id: mat.catalog_id
    }) : sealMaterialKeyFromSeal(sealAttr);
    const typeSum = key ? sumSealLengthsForType(key) : 0;
    const typeBit = typeSum > 0 ? ` Totaal ${mat?.catalog_id || DEFAULT_KIER_CATALOG_ID} \u2248 ${typeSum.toFixed(2)} m.` : "";
    const composeHint = editing && !isComposeResultRoom(editing) ? " Meestal op een samengesteld (\xB1) component." : "";
    if (hasSeal) {
      kierSuggestHintEl.textContent = `Kierdichting aan \u2014 vink uit om uit te zetten. Opslaan werkt de omtreklengte bij.${periBit}${typeBit}${composeHint}`;
    } else if (pendingIntent) {
      kierSuggestHintEl.textContent = `Kierdichting aangevinkt \u2014 wordt bij Opslaan toegevoegd.${periBit}${typeBit}`;
    } else if (!canToggle) {
      kierSuggestHintEl.textContent = `Open of selecteer het component om kierdichting (omtrek) aan te zetten.${periBit}${composeHint}`;
    } else if (!editing) {
      kierSuggestHintEl.textContent = `Optioneel. Vink aan v\xF3\xF3r Opslaan om omtrek als kierdichting te koppelen (standaard ${DEFAULT_KIER_CATALOG_ID}).${periBit}${typeBit}`;
    } else {
      kierSuggestHintEl.textContent = `Optioneel kenmerk. Standaard ${DEFAULT_KIER_CATALOG_ID}. Lengtes van hetzelfde type worden opgeteld.${periBit}${typeBit}${composeHint}`;
    }
  }
}
async function saveComponentSealAttribute(room, want, material) {
  if (!activeSection || !auth()) {
    throw new Error("Geen actieve sectie");
  }
  const lengthM = perimeterMOfRing(room.points);
  let mat = null;
  let seal;
  if (want) {
    await ensureKierMaterials();
    mat = material || resolveKierSuggestMaterial();
    if (!mat) {
      throw new Error(`Kierdichtingsmateriaal ${DEFAULT_KIER_CATALOG_ID} niet gevonden in de catalogus`);
    }
    seal = buildSealPayload(mat, lengthM, true);
  } else {
    seal = clearSealPayload();
  }
  const wasOn = componentHasSeal(room);
  const analysis = mergeAnalysisWithSeal(room.analysis, want ? seal : null);
  const saved = await saveDrawingSubsection({
    section_id: activeSection.id,
    subsection_id: room.id,
    label: room.label,
    level_hint: room.level_hint || "OTHER",
    vg_nr: room.vg_nr,
    vr_nr: room.vr_nr,
    points: room.points,
    holes: Array.isArray(room.analysis?.holes) ? room.analysis.holes : [],
    metres_per_norm_unit: room.metres_per_norm_unit ?? activeScaleMpu() ?? void 0,
    scale_aspect_yx: activeScaleAspect(),
    analysis
  });
  markRoomTouched(room.id);
  const idx = rooms.findIndex((r) => r.id === room.id);
  if (idx >= 0) {
    const nextAnalysis = {
      ...rooms[idx].analysis || {},
      ...saved.analysis || {},
      ...analysis
    };
    if (!want) delete nextAnalysis.seal;
    rooms[idx] = {
      ...rooms[idx],
      analysis: nextAnalysis
    };
    noteLocalRoomPatch(rooms[idx]);
  }
  const legacy = existingSealFor(room.id);
  if (legacy) {
    try {
      await deleteDrawingSubsection(legacy.id);
      noteLocalRoomDeletion(legacy.id);
      rooms = rooms.filter((r) => r.id !== legacy.id);
      selectedSetIds.delete(legacy.id);
      constituentSigns.delete(legacy.id);
    } catch (err) {
      console.warn("legacy seal cleanup failed", err);
    }
  }
  return {
    length_m: want ? lengthM : null,
    created: want && !wasOn,
    material: mat
  };
}
async function removeSealForParent(parentId) {
  const room = rooms.find((r) => r.id === parentId);
  if (!room) {
    const seal = existingSealFor(parentId);
    if (!seal) return false;
    await deleteDrawingSubsection(seal.id);
    if (pendingRoom?.editingId === seal.id) clearPendingRoom();
    if (touchedRoomIds.delete(seal.id)) persistTouchedRoomIds();
    selectedSetIds.delete(seal.id);
    constituentSigns.delete(seal.id);
    noteLocalRoomDeletion(seal.id);
    rooms = rooms.filter((r) => r.id !== seal.id);
    return true;
  }
  if (!componentHasSeal(room) && !existingSealFor(parentId)) return false;
  await saveComponentSealAttribute(room, false);
  return true;
}
async function toggleKierSealForRoom(room, want) {
  if (isFloormapKind() || componentIsLengthQuantity(room) || isLegacySealSibling(room.analysis)) {
    return;
  }
  if (!Array.isArray(room.points) || room.points.length < 3) {
    setStatus("Gesloten vlak nodig voor kierdichting (omtrek)", "err");
    if (kierSuggestCb) kierSuggestCb.checked = componentHasSeal(room);
    return;
  }
  const canToggle = selectedSetIds.has(room.id) || pendingRoom?.editingId === room.id;
  if (want && !canToggle) {
    setStatus("Open of selecteer het component om kierdichting toe te voegen", "err");
    if (kierSuggestCb && pendingRoom?.editingId === room.id) {
      kierSuggestCb.checked = componentHasSeal(room);
    }
    renderRoomList();
    return;
  }
  kierToggleInFlight = true;
  try {
    setStatus(want ? "Kierdichting zetten\u2026" : "Kierdichting uitzetten\u2026", "busy");
    const result = await saveComponentSealAttribute(room, want);
    renderRoomList();
    drawOverlay();
    requestAnimationFrame(() => drawOverlay());
    if (kierSuggestCb && pendingRoom?.editingId === room.id) {
      kierSuggestCb.checked = want;
      delete kierSuggestCb.dataset.userTouched;
    }
    if (!want) {
      setStatus("Kierdichting uit", "ok");
      return;
    }
    const mat = result.material;
    const code = mat?.catalog_id || DEFAULT_KIER_CATALOG_ID;
    const key = mat ? sealMaterialKey({
      material_id: mat.material_id,
      catalog_id: mat.catalog_id
    }) : "";
    const typeSum = key ? sumSealLengthsForType(key) : 0;
    const lenTxt = result.length_m != null ? ` \xB7 ${result.length_m.toFixed(2)} m` : "";
    const sumTxt = typeSum > 0 ? ` \xB7 totaal ${code} ${typeSum.toFixed(2)} m` : "";
    setStatus(
      result.created ? `Kierdichting (${code}) aan op \xAB${room.label || "vlak"}\xBB${lenTxt}${sumTxt}` : `Kierdichting (${code}) bijgewerkt${lenTxt}${sumTxt}`,
      "ok"
    );
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
    if (kierSuggestCb && pendingRoom?.editingId === room.id) {
      kierSuggestCb.checked = componentHasSeal(room);
      delete kierSuggestCb.dataset.userTouched;
    }
    renderRoomList();
    drawOverlay();
  } finally {
    kierToggleInFlight = false;
    if (pendingRoom?.editingId === room.id) syncKierSuggestUi();
  }
}
function componentIsLengthQuantity(r) {
  const a = r.analysis;
  if (a?.quantity_kind === "length") return true;
  if (a?.length_m != null && Number.isFinite(a.length_m)) return true;
  return isLengthQuantityRubriek(a?.rubriek_nr ?? a?.master_category);
}
var REPEAT_COUNT_MAX = 99;
function readRepeatCount(analysis) {
  const n = Number(analysis?.repeat_count);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(REPEAT_COUNT_MAX, Math.round(n)));
}
function repeatCountBit(analysis) {
  const n = readRepeatCount(analysis);
  return n > 1 ? `\xD7${n}` : "";
}
async function saveRepeatCountForRoom(room, next) {
  if (!activeSection || !auth()?.token) return;
  const n = Math.max(1, Math.min(REPEAT_COUNT_MAX, Math.round(next)));
  const prev = room.analysis || {};
  const analysis = { ...prev, repeat_count: n };
  if (n <= 1) delete analysis.repeat_count;
  setStatus(n > 1 ? `Herhaling \xD7${n}\u2026` : "Herhaling 1\xD7\u2026", "busy");
  try {
    const saved = await saveDrawingSubsection({
      section_id: activeSection.id,
      subsection_id: room.id,
      label: room.label,
      level_hint: room.level_hint || "OTHER",
      vg_nr: room.vg_nr,
      vr_nr: room.vr_nr,
      points: room.points,
      holes: Array.isArray(room.analysis?.holes) ? room.analysis.holes : [],
      metres_per_norm_unit: room.metres_per_norm_unit ?? activeScaleMpu() ?? void 0,
      scale_aspect_yx: activeScaleAspect(),
      analysis
    });
    const idx = rooms.findIndex((r) => r.id === room.id);
    if (idx >= 0) {
      const nextA = {
        ...rooms[idx].analysis || {},
        ...saved.analysis || {},
        ...analysis
      };
      if (n <= 1) delete nextA.repeat_count;
      rooms[idx] = { ...rooms[idx], analysis: nextA };
      noteLocalRoomPatch(rooms[idx]);
    }
    markRoomTouched(room.id);
    renderRoomList();
    drawOverlay();
    setStatus(
      n > 1 ? `\xAB${room.label || "component"}\xBB telt \xD7${n} mee in GA` : `\xAB${room.label || "component"}\xBB telt 1\xD7 mee in GA`,
      "ok"
    );
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
    renderRoomList();
  }
}
function roomMetricsLabel(r) {
  const mpu = r.metres_per_norm_unit != null && r.metres_per_norm_unit > 0 ? r.metres_per_norm_unit : activeScaleMpu();
  const aspect = activeScaleAspect();
  const live = pendingRoom?.editingId === r.id ? pendingRoom : null;
  const pts = live ? live.points : r.points;
  const holes = live ? live.holes || [] : Array.isArray(r.analysis?.holes) ? r.analysis.holes : [];
  const closed = live ? live.closed : true;
  try {
    if (componentIsLengthQuantity(r) || live && !closed && selectedIsKierdichting()) {
      let len = null;
      if (pts?.length >= 2 && mpu) {
        len = `${scaledPathLength(pts, mpu, aspect, closed).toFixed(2)} m`;
      } else if (r.analysis?.length_m != null && Number.isFinite(r.analysis.length_m) && !live) {
        len = `${Number(r.analysis.length_m).toFixed(2)} m`;
      } else if (r.perimeter_m != null && Number.isFinite(r.perimeter_m) && !live) {
        len = `${r.perimeter_m.toFixed(2)} m`;
      }
      const key = sealMaterialKey(r.analysis);
      const typeSum = key ? sumSealLengthsForType(key) : 0;
      const code = (r.analysis?.catalog_id || "").trim() || DEFAULT_KIER_CATALOG_ID;
      const sumBit = typeSum > 0 && (!len || Math.abs(typeSum - Number.parseFloat(len)) > 5e-3) ? ` \xB7 \u03A3 ${code} ${typeSum.toFixed(2)} m` : "";
      const nLen = readRepeatCount(r.analysis);
      const repLen = nLen > 1 ? ` \xB7 \xD7${nLen}` : "";
      return len ? `lengte ${len}${repLen}${sumBit}` : "lengte \u2014";
    }
    let area = "\u2014";
    let circ = "\u2014";
    if (pts?.length >= 3 && mpu) {
      const safeHoles = holes.filter((h) => Array.isArray(h) && h.length >= 3);
      const holesSum = safeHoles.reduce((s, h) => s + shoelaceArea(h), 0);
      const areaNorm = Math.max(0, shoelaceArea(pts) - holesSum);
      area = `${scaledAreaM2(areaNorm, mpu, aspect).toFixed(2)} m\xB2`;
      circ = `${scaledPathLength(pts, mpu, aspect, true).toFixed(2)} m`;
    } else if (r.area_m2 != null && Number.isFinite(r.area_m2)) {
      area = `${r.area_m2.toFixed(2)} m\xB2`;
      if (r.perimeter_m != null && Number.isFinite(r.perimeter_m)) {
        circ = `${r.perimeter_m.toFixed(2)} m`;
      }
    } else if (r.area_norm != null && mpu) {
      area = `${scaledAreaM2(r.area_norm, mpu, aspect).toFixed(2)} m\xB2`;
    } else if (r.area_norm != null) {
      area = `${r.area_norm.toFixed(4)} (geen schaal)`;
    }
    const n = readRepeatCount(r.analysis);
    const rep = n > 1 ? ` \xB7 \xD7${n}` : "";
    return `${area}${rep} \xB7 omtrek ${circ}`;
  } catch {
    return "\u2014";
  }
}
var roomListRefreshTimer = null;
var roomListRefreshQuiet = false;
function scheduleRoomListRefresh() {
  if (!pendingRoom?.editingId) return;
  if (roomListRefreshTimer) clearTimeout(roomListRefreshTimer);
  roomListRefreshTimer = setTimeout(() => {
    roomListRefreshTimer = null;
    roomListRefreshQuiet = true;
    try {
      syncPendingGeometryToRooms();
      renderRoomList();
    } finally {
      roomListRefreshQuiet = false;
    }
  }, 40);
}
function syncPendingRoomButtons() {
  const n = activePartNoun();
  const has = Boolean(pendingRoom && pendingRoom.points.length > 0);
  const closed = Boolean(pendingRoom?.closed);
  const kier = !isFloormapKind() && pendingSaveIsLength();
  const editingId = pendingRoom?.editingId || null;
  roomCloseBtn.disabled = !(pendingRoom?.drawing && pendingRoom.points.length >= 3 && !closed);
  const canSaveClosed = Boolean(closed && pendingRoom && pendingRoom.points.length >= 3);
  const canSaveOpenKier = Boolean(
    kier && pendingRoom && !closed && pendingRoom.points.length >= 2
  );
  roomSaveBtn.disabled = !(canSaveClosed || canSaveOpenKier);
  if (roomDuplicateBtn) {
    roomDuplicateBtn.disabled = !(canSaveClosed && !kier);
  }
  roomClearBtn.disabled = !has && !pendingRoom?.drawing;
  if (roomDeleteBtn) {
    const deleteIds = deleteTargetIds();
    const confirming = pendingDeleteId != null && pendingDeleteId === deleteConfirmKey(deleteIds);
    roomDeleteBtn.disabled = deleteIds.length === 0;
    if (confirming) {
      roomDeleteBtn.textContent = "Bevestig wissen";
      roomDeleteBtn.title = deleteIds.length > 1 ? `Nogmaals klikken wist ${deleteIds.length} aangevinkte componenten permanent` : "Nogmaals klikken wist dit component permanent";
      roomDeleteBtn.classList.remove("secondary");
    } else {
      roomDeleteBtn.textContent = "Verwijderen";
      roomDeleteBtn.title = deleteIds.length > 1 ? `Verwijder ${deleteIds.length} aangevinkte componenten (twee keer klikken)` : (() => {
        const editingRoom = editingId ? rooms.find((r) => r.id === editingId) : null;
        return editingRoom && isComposeResultRoom(editingRoom) ? "Verwijdert alleen dit samengestelde resultaat; broncomponenten blijven bestaan" : `Opgeslagen ${n.singular} permanent verwijderen`;
      })();
      roomDeleteBtn.classList.add("secondary");
    }
  }
  if (roomSimplifyBtn) {
    roomSimplifyBtn.disabled = !(closed && pendingRoom && ringVertexCount(pendingRoom.points) > 3);
  }
  if (!pendingRoom) {
    roomPendingHintEl.textContent = kier ? `Kierdichting: teken een pad (\u22652 punten) of gesloten omtrek; lengte in meters wordt opgeslagen.` : `Gebruik Teken ${n.singular} (Gereedschap of hier), klik hoekpunten. Dubbelklik een rand om een anker toe te voegen; dubbelklik een anker om te verwijderen; Vereenvoudig dunt de omtrek.`;
    roomDrawBtn.textContent = `Teken ${n.singular}`;
    roomSaveBtn.textContent = "Opslaan";
    return;
  }
  if (pendingRoom.drawing && !pendingRoom.closed) {
    roomPendingHintEl.textContent = kier ? `${pendingRoom.points.length} punt(en). Opslaan mag vanaf 2 punten (lengte), of sluit polygoon voor omtrek.` : `${pendingRoom.points.length} hoekpunt(en). Omtrek/oppervlakte hierboven; sluit polygoon als klaar (\u22653).`;
    roomDrawBtn.textContent = "Annuleren";
  } else if (pendingRoom.closed) {
    roomPendingHintEl.textContent = pendingRoom.editingId ? "Bewerken: sleep vlak/ankers; dubbelklik op een rand voor extra anker; dubbelklik anker om te wissen; daarna Opslaan." : kier ? "Polygoon klaar \u2014 omtrek (m) wordt als lengte opgeslagen voor kierdichting." : "Polygoon klaar \u2014 sleep vlak/ankers; dubbelklik op een rand voor extra anker; daarna Opslaan.";
    roomDrawBtn.textContent = `Teken ${n.singular}`;
  }
  roomSaveBtn.textContent = editingId ? "Wijzigingen opslaan" : "Opslaan";
  if (markRoomLegendEl) {
    const cap = n.singular.charAt(0).toUpperCase() + n.singular.slice(1);
    markRoomLegendEl.textContent = cap;
  }
  syncEditDock();
  syncKierSuggestUi();
}
function syncEditDock() {
  if (!editDockEl) return;
  const show = Boolean(pendingRoom?.closed && !discovery);
  editDockEl.classList.toggle("hidden", !show);
}
function clearPendingRoom() {
  pendingRoom = null;
  if (kierSuggestCb) {
    kierSuggestCb.checked = false;
    delete kierSuggestCb.dataset.userTouched;
  }
  syncPendingRoomButtons();
  syncEditDock();
  syncToolButtons();
  updateMeasureReadouts();
  updateToolHint();
  renderRoomList();
  drawOverlay();
}
function beginDrawRoom() {
  endDiscovery();
  endCalibrate();
  if (measure.tool !== "off") clearMeasure(false);
  const defaultLabel = `${activePartNoun().singular.charAt(0).toUpperCase() + activePartNoun().singular.slice(1)} ${rooms.length + 1}`;
  pendingRoom = {
    points: [],
    holes: [],
    closed: false,
    editingId: null,
    dragVertex: null,
    dragBodyLast: null,
    drawing: true,
    drawCursor: null,
    label: defaultLabel
  };
  roomLabelInput.value = defaultLabel;
  fillVgVrSuggestions();
  clearExpectedOrientaties();
  if (!isFloormapKind()) setComponentOrientatie(lastComponentOrientatie);
  syncPendingRoomButtons();
  syncToolButtons();
  updateMeasureReadouts();
  updateToolHint();
  setStatus("Klik hoeken van de ruimte op de tekening", "busy");
  overlayCanvas.style.cursor = "crosshair";
  drawOverlay();
}
function startDrawRoom() {
  if (pendingRoom?.drawing) {
    clearPendingRoom();
    setStatus("Tekenen geannuleerd", "ok");
    return;
  }
  beginDrawRoom();
}
function closePendingPolygon() {
  if (!pendingRoom || pendingRoom.points.length < 3) return;
  pendingRoom.points = closeRing(pendingRoom.points);
  pendingRoom.closed = true;
  pendingRoom.drawing = false;
  pendingRoom.drawCursor = null;
  syncPendingRoomButtons();
  syncEditDock();
  syncToolButtons();
  updateMeasureReadouts();
  updateToolHint();
  scheduleRoomListRefresh();
  setStatus(`Polygoon gesloten \u2014 sleep vlak/ankers of gebruik pijltjes; sla op als klaar`, "ok");
  drawOverlay();
}
function parseBooleanOp(raw) {
  if (raw === "intersect" || raw === "union" || raw === "difference" || raw === "compose") {
    return raw;
  }
  return null;
}
function isOpenComponent(r) {
  if (r.analysis?.open_path) return true;
  if (r.analysis?.quantity_kind === "length") return true;
  return ringVertexCount(r.points) < 3;
}
function ensureDefaultSigns(selected) {
  if (selected.length < 1) return;
  const outer = differenceSubject(selected);
  for (const r of selected) {
    if (constituentSigns.has(r.id)) continue;
    constituentSigns.set(r.id, outer && r.id === outer.id ? "+" : "-");
  }
  for (const id of [...constituentSigns.keys()]) {
    if (!selectedSetIds.has(id)) constituentSigns.delete(id);
  }
}
function buildComposeParts(selected) {
  if (selected.length < 2) throw new Error("Selecteer minstens 2 componenten");
  for (const r of selected) {
    if (isOpenComponent(r)) {
      throw new Error(`\u201C${r.label || r.id}\u201D is geen gesloten vlak`);
    }
  }
  ensureDefaultSigns(selected);
  const outer = differenceSubject(selected);
  if (!outer) throw new Error("Geen buitencontour");
  for (const r of selected) {
    if (r.id === outer.id) continue;
    if (!ringFullyContained(r.points, outer.points)) {
      throw new Error(
        `\u201C${r.label || r.id}\u201D past niet volledig binnen de buitencontour \u201C${outer.label || outer.id}\u201D (grootste). Overige delen moeten volledig in de buitencontour passen.`
      );
    }
  }
  const parts = selected.map((room) => ({
    room,
    sign: constituentSigns.get(room.id) || (room.id === outer.id ? "+" : "-")
  }));
  if (!parts.some((p) => p.sign === "+")) {
    throw new Error("Minstens \xE9\xE9n deel met + is verplicht");
  }
  const plusParts = parts.filter((p) => p.sign === "+");
  const minusParts = parts.filter((p) => p.sign === "-");
  const plusArea = plusParts.reduce((s, p) => s + subsectionAreaNorm(p.room), 0);
  for (const m of minusParts) {
    const mArea = subsectionAreaNorm(m.room);
    const mLabel = m.room.label || m.room.id;
    if (mArea >= plusArea - 1e-12) {
      const plusLabels = plusParts.map((p) => `\u201C${p.room.label || p.room.id}\u201D`).join(", ");
      throw new Error(
        `Kan \u201C${mLabel}\u201D niet aftrekken van kleinere + deel(en) (${plusLabels}). Trek alleen kleinere objecten af die volledig binnen de + contour(en) liggen.`
      );
    }
    const fitsInPlus = plusParts.some((p) => ringFullyContained(m.room.points, p.room.points));
    if (!fitsInPlus) {
      throw new Error(
        `\u201C${mLabel}\u201D past niet volledig binnen de + deel(en) \u2014 grotere of buitenliggende objecten kunnen niet worden afgetrokken.`
      );
    }
  }
  const signs = {};
  for (const p of parts) signs[p.room.id] = p.sign;
  return { outer, parts, signs };
}
function renderComposeParts() {
  if (!composePartsEl) return;
  composePartsEl.replaceChildren();
  if (isFloormapKind()) return;
  const selected = rooms.filter((r) => selectedSetIds.has(r.id));
  if (selected.length < 1) return;
  ensureDefaultSigns(selected);
  const outer = differenceSubject(selected);
  for (const r of sortByAreaDesc(selected)) {
    const li = document.createElement("li");
    li.className = "compose-part-row";
    if (outer && r.id === outer.id) li.classList.add("is-outer");
    const label = document.createElement("span");
    label.className = "compose-part-label";
    label.textContent = r.label || "(zonder label)";
    label.title = label.textContent;
    li.appendChild(label);
    if (outer && r.id === outer.id) {
      const badge = document.createElement("span");
      badge.className = "compose-part-badge";
      badge.textContent = "buiten";
      li.appendChild(badge);
    }
    const btns = document.createElement("div");
    btns.className = "compose-sign-btns";
    const sign = constituentSigns.get(r.id) || (outer && r.id === outer.id ? "+" : "-");
    for (const s of ["+", "-"]) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `compose-sign-btn secondary ${s === "+" ? "sign-plus" : "sign-minus"}`;
      if (sign === s) b.classList.add("active");
      b.textContent = s === "+" ? "+" : "\u2212";
      b.title = s === "+" ? "Meenemen in compositie" : "Aftrekken van compositie";
      b.addEventListener("click", () => {
        constituentSigns.set(r.id, s);
        renderComposeParts();
        updateBooleanPreview();
      });
      btns.appendChild(b);
    }
    li.appendChild(btns);
    composePartsEl.appendChild(li);
  }
}
var BOOL_LIST_PALETTE = [
  {
    accent: "#1565c0",
    border: "#90caf9",
    bg: "#e3f2fd",
    accentSource: "#64b5f6",
    borderSource: "#bbdefb",
    bgSource: "#f3f9fe"
  },
  {
    accent: "#2e7d32",
    border: "#a5d6a7",
    bg: "#e8f5e9",
    accentSource: "#81c784",
    borderSource: "#c8e6c9",
    bgSource: "#f4faf4"
  },
  {
    accent: "#c62828",
    border: "#ef9a9a",
    bg: "#ffebee",
    accentSource: "#e57373",
    borderSource: "#ffcdd2",
    bgSource: "#fff6f6"
  },
  {
    accent: "#ef6c00",
    border: "#ffcc80",
    bg: "#fff3e0",
    accentSource: "#ffb74d",
    borderSource: "#ffe0b2",
    bgSource: "#fffaf3"
  },
  {
    accent: "#00838f",
    border: "#80deea",
    bg: "#e0f7fa",
    accentSource: "#4dd0e1",
    borderSource: "#b2ebf2",
    bgSource: "#f2fbfc"
  },
  {
    accent: "#455a64",
    border: "#b0bec5",
    bg: "#eceff1",
    accentSource: "#90a4ae",
    borderSource: "#cfd8dc",
    bgSource: "#f7f9fa"
  }
];
function assignBooleanListGroups(items) {
  const map = /* @__PURE__ */ new Map();
  let group = 0;
  for (const r of items) {
    const op = parseBooleanOp(r.analysis?.boolean_op);
    const src = r.analysis?.source_subsection_ids;
    if (!op || !Array.isArray(src) || src.length < 2) continue;
    map.set(r.id, { role: "result", group });
    for (const sid of src) {
      if (!sid || sid === r.id) continue;
      const existing = map.get(sid);
      if (existing?.role === "result") continue;
      if (!existing) map.set(sid, { role: "source", group });
    }
    group += 1;
  }
  return map;
}
function isComposeResultRoom(r) {
  const op = parseBooleanOp(r.analysis?.boolean_op);
  return op === "compose" || op === "difference";
}
function collectComposeSourceRefs(compose, allItems) {
  const src = compose.analysis?.source_subsection_ids;
  if (!Array.isArray(src) || src.length < 2) return [];
  const byId = new Map(allItems.map((x) => [x.id, x]));
  const signs = compose.analysis?.constituent_signs || {};
  const storedLabels = Array.isArray(compose.analysis?.source_labels) ? compose.analysis.source_labels : [];
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  src.forEach((sid, i) => {
    if (!sid || seen.has(sid)) return;
    seen.add(sid);
    const room = byId.get(sid);
    const rawSign = signs[sid];
    const sign = rawSign === "+" || rawSign === "-" ? rawSign : "?";
    let label = (room?.label || "").trim();
    if (!label && storedLabels[i]) {
      label = String(storedLabels[i]).replace(/^[±+\-]\s*/, "").trim();
    }
    if (!label) label = sid.slice(0, 8);
    out.push({ id: sid, label, sign, missing: !room });
  });
  return out;
}
function composeParentsOfSource(sourceId, allItems) {
  return allItems.filter(
    (r) => isComposeResultRoom(r) && Array.isArray(r.analysis?.source_subsection_ids) && r.analysis.source_subsection_ids.includes(sourceId)
  );
}
function focusComposeSourceInList(sourceId) {
  const listEl = resolveRoomListEl();
  if (!listEl) return;
  const room = rooms.find((r) => r.id === sourceId);
  const li = listEl.querySelector(
    `.drawing-list-item[data-room-id="${CSS.escape(sourceId)}"]`
  );
  if (!li) {
    if (room && roomListVrFilter && !roomMatchesVrFilter(room, roomListVrFilter)) {
      setStatus(
        `Bron \xAB${room.label || sourceId}\xBB hoort bij VR ${normalizeVrNr(room.vr_nr) || "\u2014"} \u2014 zet de VR-filter daarop of kies Alle VR's`,
        "err"
      );
      return;
    }
    setStatus("Broncomponent niet gevonden in de lijst", "err");
    return;
  }
  scrollActiveRoomListItemIntoView(listEl, sourceId);
  listEl.querySelectorAll(".drawing-list-item--compose-flash").forEach((el) => el.classList.remove("drawing-list-item--compose-flash"));
  li.classList.add("drawing-list-item--compose-flash");
  if (composeFlashTimer != null) window.clearTimeout(composeFlashTimer);
  composeFlashTimer = window.setTimeout(() => {
    li.classList.remove("drawing-list-item--compose-flash");
    composeFlashTimer = null;
  }, 1800);
  setStatus(`Bron: \xAB${room?.label || sourceId}\xBB`, "ok");
}
function applyBooleanListColors(li, role) {
  const pal = BOOL_LIST_PALETTE[role.group % BOOL_LIST_PALETTE.length];
  if (role.role === "result") {
    li.classList.add("drawing-list-item--bool-result");
    li.style.setProperty("--bool-accent", pal.accent);
    li.style.setProperty("--bool-border", pal.border);
    li.style.setProperty("--bool-bg", pal.bg);
  } else {
    li.classList.add("drawing-list-item--bool-source");
    li.style.setProperty("--bool-accent-source", pal.accentSource);
    li.style.setProperty("--bool-border-source", pal.borderSource);
    li.style.setProperty("--bool-bg-source", pal.bgSource);
  }
  li.dataset.boolGroup = String(role.group);
}
async function recalculateBooleanDependents(rootId) {
  if (!activeSection || !auth()?.token || !rootId) return 0;
  let changed = /* @__PURE__ */ new Set([rootId]);
  let updated = 0;
  for (let wave = 0; wave < 24 && changed.size > 0; wave++) {
    const dependents = rooms.filter((r) => {
      if (r.id === rootId && wave === 0) return false;
      const op = parseBooleanOp(r.analysis?.boolean_op);
      const src = r.analysis?.source_subsection_ids;
      return Boolean(op && Array.isArray(src) && src.some((id) => changed.has(id)));
    });
    if (dependents.length === 0) break;
    const nextChanged = /* @__PURE__ */ new Set();
    for (const dep of dependents) {
      const op = parseBooleanOp(dep.analysis?.boolean_op);
      const srcIds = dep.analysis?.source_subsection_ids || [];
      if (!op || srcIds.length < 2) continue;
      const srcRooms = srcIds.map((id) => rooms.find((r) => r.id === id)).filter((r) => Boolean(r?.points?.length));
      if (srcRooms.length < 2) {
        setStatus(`Kan \u201C${dep.label}\u201D niet herberekenen \u2014 broncomponent ontbreekt`, "err");
        continue;
      }
      try {
        let result;
        if (op === "compose") {
          const stored = dep.analysis?.constituent_signs || {};
          const outerId = dep.analysis?.outer_subsection_id || differenceSubject(srcRooms)?.id;
          const signed = srcRooms.map((r) => {
            const raw = stored[r.id];
            const sign = raw === "+" || raw === "-" ? raw : outerId && r.id === outerId ? "+" : "-";
            return { ring: r.points, sign };
          });
          const outer = outerId ? srcRooms.find((r) => r.id === outerId) : differenceSubject(srcRooms);
          if (outer) {
            for (const r of srcRooms) {
              if (r.id === outer.id) continue;
              if (!ringFullyContained(r.points, outer.points)) {
                throw new Error(
                  `\u201C${r.label}\u201D past niet meer binnen buitencontour \u201C${outer.label}\u201D`
                );
              }
            }
          }
          result = composeSigned(signed);
        } else {
          result = booleanCombineLargest(
            op,
            srcRooms.map((r) => r.points)
          );
        }
        const mpu = dep.metres_per_norm_unit != null && dep.metres_per_norm_unit > 0 ? dep.metres_per_norm_unit : activeScaleMpu();
        const areaM2 = mpu != null ? Math.round(scaledAreaM2(result.areaNorm, mpu, activeScaleAspect()) * 100) / 100 : null;
        const prev = dep.analysis || {};
        await saveDrawingSubsection({
          section_id: activeSection.id,
          subsection_id: dep.id,
          label: dep.label,
          level_hint: dep.level_hint || "OTHER",
          vg_nr: dep.vg_nr,
          vr_nr: dep.vr_nr,
          points: result.outer,
          holes: result.holes,
          metres_per_norm_unit: mpu ?? void 0,
          scale_aspect_yx: activeScaleAspect(),
          analysis: {
            ...prev,
            boolean_op: op,
            source_subsection_ids: srcIds,
            holes: result.holes,
            area_norm: result.areaNorm,
            area_m2: areaM2
          }
        });
        dep.points = result.outer;
        dep.area_norm = result.areaNorm;
        dep.area_m2 = areaM2;
        dep.analysis = {
          ...prev,
          boolean_op: op,
          source_subsection_ids: srcIds,
          holes: result.holes,
          area_norm: result.areaNorm,
          area_m2: areaM2 ?? void 0
        };
        noteLocalRoomPatch(dep);
        nextChanged.add(dep.id);
        updated += 1;
      } catch (err) {
        setStatus(
          `Herberekenen \u201C${dep.label}\u201D mislukt: ${err instanceof Error ? err.message : String(err)}`,
          "err"
        );
      }
    }
    changed = nextChanged;
  }
  return updated;
}
async function savePendingRoom() {
  if (!pendingRoom || !activeSection || !auth()) {
    setStatus("Niets om op te slaan \u2014 open eerst een component om te bewerken", "err");
    return;
  }
  const kier = !isFloormapKind() && pendingSaveIsLength();
  const openPath = Boolean(kier && !pendingRoom.closed && pendingRoom.points.length >= 2);
  if (!openPath && !pendingRoom.closed) {
    setStatus("Sluit eerst de polygoon (\u22653 punten) voordat je opslaat", "err");
    return;
  }
  const pointsSnap = openPath ? clampPath(pendingRoom.points.map((p) => ({ ...p }))) : closeRing(pendingRoom.points.map((p) => ({ ...p })));
  const holesSnap = openPath ? [] : (pendingRoom.holes || []).map((h) => h.map((p) => ({ ...p })));
  const editingId = pendingRoom.editingId;
  const points = pointsSnap;
  const mpu = activeScaleMpu();
  if (kier) {
    const lenNorm = openPath ? openPolylineLength(points) : polylinePerimeter(points);
    if (lenNorm < 1e-8) {
      setStatus("Lengte te klein", "err");
      return;
    }
  } else if (shoelaceArea(points) < 1e-8) {
    setStatus("Ruimte te klein", "err");
    return;
  }
  const label = (pendingRoom.label || roomLabelInput.value).trim() || `${activePartNoun().singular.charAt(0).toUpperCase() + activePartNoun().singular.slice(1)} ${rooms.length + 1}`;
  roomLabelInput.value = label;
  pendingRoom.label = label;
  const level = roomLevelSelect.value || "OTHER";
  const vgVr = parseVgVrInputs();
  if (vgVr.error) {
    setStatus(vgVr.error, "err");
    return;
  }
  if (isFloormapKind() && (vgVr.vg_nr == null || vgVr.vr_nr == null)) {
    setStatus("Vul VG- en VR-nummer in", "err");
    return;
  }
  if (isFloormapKind()) {
    const oris = readExpectedOrientaties();
    if (!oris.length) {
      setStatus(
        "Vink minstens \xE9\xE9n gevelori\xEBntatie aan (N\u2026NW) \u2014 verplicht voor deze VR voordat je opslaat",
        "err"
      );
      expectedOriBlockEl?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      return;
    }
  } else if (!readComponentOrientatie()) {
    setStatus("Kies een gevelori\xEBntatie (N\u2026NW) voor dit component", "err");
    componentOriBlockEl?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    return;
  }
  const mat = !isFloormapKind() ? selectedCatalogMaterial() : null;
  if (kier && !mat) {
    setStatus("Kies een kierdichtingsmateriaal (rubriek 9)", "err");
    return;
  }
  const wantSeal = !isFloormapKind() && !kier && Boolean(pendingRoom.closed) && Boolean(kierSuggestCb?.checked);
  if (wantSeal) {
    await ensureKierMaterials();
    if (!resolveKierSuggestMaterial()) {
      setStatus(
        `Kierdichting aangevinkt, maar ${DEFAULT_KIER_CATALOG_ID} (of een ander kierprofiel) is niet beschikbaar`,
        "err"
      );
      return;
    }
  }
  roomSaveBtn.disabled = true;
  setStatus(editingId ? "Geometrie bijwerken\u2026" : "Opslaan\u2026", "busy");
  try {
    const body = {
      section_id: activeSection.id,
      subsection_id: editingId || void 0,
      label,
      level_hint: level,
      vg_nr: vgVr.vg_nr,
      vr_nr: vgVr.vr_nr,
      points,
      holes: holesSnap,
      metres_per_norm_unit: mpu ?? void 0,
      open_path: openPath || void 0,
      scale_aspect_yx: activeScaleAspect()
    };
    const prevAnalysis = editingId ? rooms.find((r) => r.id === editingId)?.analysis : null;
    if (mat) {
      const analysis = {
        material_id: mat.material_id,
        master_category: mat.master_category,
        material_name: mat.name,
        catalog_id: mat.catalog_id,
        category: mat.category || void 0,
        rubriek_nr: mat.rubriek_nr ?? void 0
      };
      if (kier) {
        const lengthM = mpu != null ? Math.round(
          scaledPathLength(points, mpu, activeScaleAspect(), !openPath) * 100
        ) / 100 : void 0;
        analysis.quantity_kind = "length";
        analysis.length_norm = openPath ? openPolylineLength(points) : polylinePerimeter(points);
        if (lengthM != null) analysis.length_m = lengthM;
        analysis.open_path = openPath;
      }
      body.analysis = isFloormapKind() ? analysis : gevelAnalysisForSave(prevAnalysis, analysis);
      if (!editingId && !(pendingRoom.label || roomLabelInput.value).trim()) {
        body.label = `${mat.master_category}: ${mat.name}`;
      }
    } else if (isFloormapKind()) {
      body.analysis = {
        expected_orientaties: readExpectedOrientaties(),
        orientatie_correcties: readOrientatieCorrecties()
      };
    } else {
      body.analysis = gevelAnalysisForSave(prevAnalysis);
    }
    const saved = await saveDrawingSubsection(body);
    const wasEdit = Boolean(editingId);
    const savedId = saved.subsection_id;
    markRoomTouched(savedId);
    noteLocalLabel(savedId, String(body.label || label));
    const savedVg = saved.vg_nr != null && Number.isFinite(Number(saved.vg_nr)) ? Number(saved.vg_nr) : vgVr.vg_nr;
    const savedVr = saved.vr_nr != null && String(saved.vr_nr).trim() ? String(saved.vr_nr).trim() : vgVr.vr_nr;
    const idx = rooms.findIndex((r) => normRoomId(r.id) === normRoomId(savedId));
    let patched;
    if (idx >= 0) {
      const prev = rooms[idx];
      patched = {
        ...prev,
        points: points.map((p) => ({ ...p })),
        label: String(body.label || prev.label),
        level_hint: level,
        vg_nr: savedVg,
        vr_nr: savedVr,
        area_m2: saved.area_m2 != null ? Number(saved.area_m2) : prev.area_m2,
        area_norm: saved.area_norm != null ? Number(saved.area_norm) : prev.area_norm,
        perimeter_m: saved.perimeter_m != null ? Number(saved.perimeter_m) : prev.perimeter_m,
        analysis: {
          ...prev.analysis || {},
          ...typeof body.analysis === "object" && body.analysis ? body.analysis : {},
          ...saved.analysis || {},
          holes: holesSnap.length ? holesSnap : void 0
        }
      };
      rooms[idx] = patched;
    } else {
      patched = {
        id: savedId,
        section_id: activeSection.id,
        label: String(body.label || label),
        level_hint: level,
        vg_nr: savedVg,
        vr_nr: savedVr,
        points: points.map((p) => ({ ...p })),
        area_m2: saved.area_m2 != null ? Number(saved.area_m2) : null,
        area_norm: saved.area_norm != null ? Number(saved.area_norm) : null,
        perimeter_m: saved.perimeter_m != null ? Number(saved.perimeter_m) : null,
        perimeter_norm: null,
        metres_per_norm_unit: mpu,
        analysis_status: "ok",
        sort_order: rooms.length,
        analysis: {
          ...typeof body.analysis === "object" && body.analysis ? body.analysis : {},
          ...saved.analysis || {},
          holes: holesSnap.length ? holesSnap : void 0
        }
      };
      rooms = [...rooms, patched];
    }
    noteLocalRoomPatch(patched);
    roomsLoadEpoch += 1;
    renderRoomList();
    drawOverlay();
    let sealBit = "";
    let sealMatForSum = null;
    const savedRoomForSeal = rooms.find((r) => r.id === savedId);
    if (wantSeal && savedRoomForSeal) {
      const seal = await saveComponentSealAttribute(
        {
          ...savedRoomForSeal,
          points: points.map((p) => ({ ...p })),
          label: String(body.label || label),
          vg_nr: savedVg,
          vr_nr: savedVr,
          level_hint: level
        },
        true
      );
      sealMatForSum = seal.material;
      const lenTxt = seal.length_m != null ? ` ${seal.length_m.toFixed(2)} m` : "";
      sealBit = seal.created ? ` \xB7 kierdichting aan${lenTxt}` : ` \xB7 kierdichting bijgewerkt${lenTxt}`;
      const afterSeal = rooms.find((r) => r.id === savedId);
      if (afterSeal) patched = { ...patched, analysis: afterSeal.analysis };
      if (kierSuggestCb) delete kierSuggestCb.dataset.userTouched;
    } else if (editingId && !wantSeal && (componentSealEnabled(savedRoomForSeal?.analysis) || componentSealEnabled(
      rooms.find((r) => r.id === editingId)?.analysis
    ) || existingSealFor(editingId))) {
      const removed = await removeSealForParent(editingId);
      if (removed) sealBit = " \xB7 kierdichting uit";
      const afterSeal = rooms.find((r) => r.id === savedId);
      if (afterSeal) patched = { ...patched, analysis: afterSeal.analysis };
    }
    clearPendingRoom();
    if (isFloormapKind()) {
      roomVgInput.value = "";
      roomVrInput.value = "";
      clearExpectedOrientaties();
    } else {
      if (savedVg != null) roomVgInput.value = String(savedVg);
      if (savedVr) roomVrInput.value = savedVr;
      rememberComponentOrientatie(readComponentOrientatie());
      setComponentOrientatie(lastComponentOrientatie);
    }
    noteLocalRoomPatch(patched);
    renderRoomList();
    drawOverlay();
    try {
      await loadRooms({ preserveOrder: true });
    } catch (reloadErr) {
      renderRoomList();
      drawOverlay();
      console.warn("loadRooms after save failed", reloadErr);
    }
    {
      const i = rooms.findIndex((r) => normRoomId(r.id) === normRoomId(savedId));
      if (i >= 0) {
        rooms[i] = {
          ...rooms[i],
          points: patched.points.map((p) => ({ ...p })),
          label: patched.label,
          level_hint: patched.level_hint,
          vg_nr: patched.vg_nr,
          vr_nr: patched.vr_nr,
          area_m2: patched.area_m2 != null ? patched.area_m2 : rooms[i].area_m2,
          area_norm: patched.area_norm != null ? patched.area_norm : rooms[i].area_norm,
          perimeter_m: patched.perimeter_m != null ? patched.perimeter_m : rooms[i].perimeter_m,
          analysis: patched.analysis ? { ...rooms[i].analysis || {}, ...patched.analysis } : rooms[i].analysis
        };
        noteLocalRoomPatch(rooms[i]);
        noteLocalLabel(rooms[i].id, patched.label);
      }
      renderRoomList();
      drawOverlay();
    }
    requestAnimationFrame(() => drawOverlay());
    if (sealMatForSum && sealBit) {
      const key = sealMaterialKey({
        material_id: sealMatForSum.material_id,
        catalog_id: sealMatForSum.catalog_id
      });
      const typeSum = sumSealLengthsForType(key);
      const code = sealMatForSum.catalog_id || DEFAULT_KIER_CATALOG_ID;
      if (typeSum > 0) sealBit += ` \xB7 totaal ${code} ${typeSum.toFixed(2)} m`;
    }
    let depCount = 0;
    let depErr = "";
    if (wasEdit && editingId) {
      setStatus("Afgeleide setbewerkingen herberekenen\u2026", "busy");
      try {
        depCount = await recalculateBooleanDependents(editingId);
        if (depCount > 0) {
          await loadRooms();
          const i = rooms.findIndex((r) => normRoomId(r.id) === normRoomId(savedId));
          if (i >= 0 && patched.analysis) {
            rooms[i] = {
              ...rooms[i],
              points: patched.points.map((p) => ({ ...p })),
              label: patched.label,
              level_hint: patched.level_hint,
              vg_nr: patched.vg_nr,
              vr_nr: patched.vr_nr,
              analysis: { ...rooms[i].analysis || {}, ...patched.analysis }
            };
            noteLocalRoomPatch(rooms[i]);
            noteLocalLabel(rooms[i].id, patched.label);
          }
          renderRoomList();
          drawOverlay();
        }
      } catch (err) {
        depErr = err instanceof Error ? err.message : String(err);
      }
    }
    const m2 = saved.area_m2 != null ? Number(saved.area_m2) : null;
    const lenM = saved.analysis?.length_m != null ? Number(saved.analysis.length_m) : saved.perimeter_m != null ? Number(saved.perimeter_m) : null;
    const depBit = depCount > 0 ? ` \xB7 ${depCount} afgeleide${depCount === 1 ? "" : "n"} herberekend` : "";
    const noMatBit = !isFloormapKind() && !mat && !kier ? " \xB7 nog geen materiaal (oranje)" : "";
    const vgBit = savedVg != null && savedVr ? ` \xB7 VG ${savedVg} \xB7 VR ${savedVr}` : !isFloormapKind() ? " \xB7 zonder VG/VR" : "";
    const oriCodes = isFloormapKind() ? readExpectedOrientaties() : [];
    const oriBit = isFloormapKind() ? oriCodes.length ? ` \xB7 ori ${oriCodes.join(",")}` : " \xB7 ori ontbreekt" : "";
    setStatus(
      wasEdit ? kier && lenM != null ? `Geometrie bijgewerkt \xB7 lengte ${lenM.toFixed(2)} m${vgBit}${oriBit}${depBit}${sealBit}` : m2 != null ? `Geometrie bijgewerkt \xB7 ${m2.toFixed(2)} m\xB2${vgBit}${oriBit}${depBit}${sealBit}${noMatBit}` : `Geometrie bijgewerkt${vgBit}${oriBit}${depBit}${sealBit}${noMatBit}` : kier && lenM != null ? `Opgeslagen ${String(body.label)} \xB7 lengte ${lenM.toFixed(2)} m${vgBit}${oriBit}` : m2 != null ? `Opgeslagen ${String(body.label)} \xB7 ${m2.toFixed(2)} m\xB2${vgBit}${oriBit}${noMatBit}${sealBit}` : `Opgeslagen ${String(body.label)}${vgBit}${oriBit}${noMatBit}${sealBit}`,
      depErr ? "err" : "ok"
    );
    if (depErr) {
      setStatus(
        `Geometrie opgeslagen, maar afgeleide setbewerking faalde: ${depErr}`,
        "err"
      );
    }
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
    syncPendingRoomButtons();
    renderRoomList();
    drawOverlay();
  } finally {
    roomSaveBtn.disabled = false;
  }
}
function ringBBox(points) {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (maxX < minX || maxY < minY) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}
function copyOffsetsAround(points, count, mode = "around") {
  const n = Math.max(1, Math.min(20, Math.floor(count)));
  const box = ringBBox(points);
  const w = Math.max(0.01, box.maxX - box.minX);
  const h = Math.max(0.01, box.maxY - box.minY);
  const span = Math.max(w, h);
  const gap = Math.max(0.012, span * 0.12);
  if (mode === "nudge") {
    const step = Math.max(0.012, Math.min(0.028, span * 0.08));
    const out2 = [];
    for (let i = 0; i < n; i++) {
      const k = i + 1;
      out2.push({ dx: step * k, dy: step * k * 0.35 });
    }
    return out2;
  }
  if (n === 1) return [{ dx: w + gap, dy: 0 }];
  const radius = span * 0.55 + gap;
  const out = [];
  for (let i = 0; i < n; i++) {
    const ang = -Math.PI / 2 + 2 * Math.PI * i / n;
    out.push({ dx: radius * Math.cos(ang), dy: radius * Math.sin(ang) });
  }
  return out;
}
function promptCopyCount(defaultCount = 1) {
  const raw = window.prompt("Aantal kopie\xEBn rond het origineel (1\u201320):", String(defaultCount));
  if (raw == null) return null;
  const n = Math.floor(Number(String(raw).trim().replace(",", ".")));
  if (!Number.isFinite(n) || n < 1 || n > 20) {
    setStatus("Voer een getal tussen 1 en 20 in", "err");
    return null;
  }
  return n;
}
function copyLabelBase(label) {
  const t = (label || "").trim() || activePartNoun().singular;
  return t.replace(/\s*\(kopie(?:\s+\d+)?\)\s*$/i, "").trim() || t;
}
function analysisForDuplicate(src) {
  const oris = Array.isArray(src?.expected_orientaties) ? src.expected_orientaties.map((c) => normalizeOrientatieCode(c)).filter(
    (c) => ORIENTATIE_CODES.includes(c)
  ) : [];
  const compOri = normalizeOrientatieCode(src?.orientatie || "");
  const hasCompOri = ORIENTATIE_CODES.includes(compOri);
  if (!src?.material_id && !src?.catalog_id && !src?.master_category && !oris.length && !hasCompOri) {
    return void 0;
  }
  const analysis = {};
  if (src?.material_id) analysis.material_id = src.material_id;
  if (src?.master_category) analysis.master_category = src.master_category;
  if (src?.material_name) analysis.material_name = src.material_name;
  if (src?.catalog_id) analysis.catalog_id = src.catalog_id;
  if (src?.category) analysis.category = src.category;
  if (src?.rubriek_nr != null) analysis.rubriek_nr = src.rubriek_nr;
  if (src?.quantity_kind === "length") {
    analysis.quantity_kind = "length";
    if (src.length_m != null) analysis.length_m = src.length_m;
    if (src.length_norm != null) analysis.length_norm = src.length_norm;
    if (src.open_path) analysis.open_path = true;
  }
  if (hasCompOri) analysis.orientatie = compOri;
  if (oris.length) analysis.expected_orientaties = oris;
  if (src?.orientatie_correcties && typeof src.orientatie_correcties === "object") {
    analysis.orientatie_correcties = src.orientatie_correcties;
  }
  return analysis;
}
async function postNewSubsection(body) {
  const saved = await saveDrawingSubsection(body);
  return { subsection_id: saved.subsection_id };
}
async function duplicateClosedComponent(opts) {
  if (!activeSection || !auth()) throw new Error("Geen actieve sectie");
  const asLength = opts.analysis?.quantity_kind === "length" || isLengthQuantityRubriek(opts.analysis?.rubriek_nr ?? opts.analysis?.master_category);
  const openPath = Boolean(asLength && opts.analysis?.open_path);
  const points = openPath ? opts.points.map((p) => ({ ...p })) : closeRing(opts.points);
  if (openPath) {
    if (points.length < 2) throw new Error("Kierdichting heeft minstens 2 punten nodig om te kopi\xEBren");
  } else if (points.length < 4 || !asLength && shoelaceArea(points) < 1e-8) {
    throw new Error("Alleen gesloten componenten met oppervlak kunnen worden gekopieerd");
  }
  const holesSrc = asLength ? [] : (opts.holes || []).map((h) => closeRing(h)).filter((h) => h.length >= 4 && shoelaceArea(h) >= 1e-8);
  const offsets = copyOffsetsAround(points, opts.count, opts.offsetMode ?? (asLength ? "nudge" : "around"));
  const mpu = activeScaleMpu();
  const base = copyLabelBase(opts.label);
  const analysisBase = analysisForDuplicate(opts.analysis);
  let lastId = null;
  let nextVr = opts.vr_nr;
  for (let i = 0; i < offsets.length; i++) {
    const { dx, dy } = offsets[i];
    const copyPoints = openPath ? points.map((p) => ({ x: p.x + dx, y: p.y + dy })) : translateRing(points, dx, dy);
    const copyHoles = holesSrc.map((h) => translateRing(h, dx, dy));
    let vg = opts.vg_nr;
    let vr = opts.vr_nr;
    if (isFloormapKind()) {
      vg = opts.vg_nr ?? suggestVgNr();
      if (i === 0) {
        roomVgInput.value = String(vg);
        roomVrInput.value = "";
        nextVr = suggestNextVrNr();
      } else {
        const n = Number(nextVr);
        nextVr = Number.isFinite(n) ? String(n + 1) : suggestNextVrNr();
      }
      vr = String(nextVr);
    }
    const label = offsets.length === 1 ? `${base} (kopie)` : `${base} (kopie ${i + 1})`;
    const body = {
      section_id: activeSection.id,
      label,
      level_hint: opts.level_hint || "OTHER",
      vg_nr: vg,
      vr_nr: vr,
      points: copyPoints,
      holes: copyHoles,
      metres_per_norm_unit: mpu ?? void 0,
      scale_aspect_yx: activeScaleAspect()
    };
    if (analysisBase) {
      const analysis = { ...analysisBase };
      if (copyHoles.length) analysis.holes = copyHoles;
      body.analysis = analysis;
    } else if (copyHoles.length) {
      body.analysis = { holes: copyHoles };
    }
    const saved = await postNewSubsection(body);
    lastId = saved.subsection_id;
    upsertOptimisticRoom({
      id: saved.subsection_id,
      section_id: activeSection.id,
      label,
      level_hint: opts.level_hint || "OTHER",
      vg_nr: vg,
      vr_nr: vr,
      points: copyPoints.map((p) => ({ ...p })),
      area_m2: saved.area_m2 != null ? Number(saved.area_m2) : null,
      area_norm: saved.area_norm != null ? Number(saved.area_norm) : null,
      perimeter_m: saved.perimeter_m != null ? Number(saved.perimeter_m) : null,
      perimeter_norm: null,
      metres_per_norm_unit: mpu,
      analysis_status: "ok",
      sort_order: rooms.length,
      analysis: body.analysis ?? null
    });
  }
  return lastId;
}
async function duplicateFromRoom(room, count) {
  const n = count ?? promptCopyCount(1);
  if (n == null) return;
  const holes = Array.isArray(room.analysis?.holes) ? room.analysis.holes.map((h) => coerceRingPoints(h)).filter((h) => h.length >= 3) : [];
  setStatus(`Kopi\xEBren (${n})\u2026`, "busy");
  try {
    const lengthDup = componentIsLengthQuantity(room);
    const lastId = await duplicateClosedComponent({
      points: room.points,
      holes,
      label: room.label,
      level_hint: room.level_hint,
      vg_nr: room.vg_nr,
      vr_nr: room.vr_nr,
      analysis: room.analysis,
      count: n,
      offsetMode: lengthDup ? "nudge" : "around"
    });
    await loadRooms();
    if (lastId) {
      const created = rooms.find((r) => r.id === lastId);
      if (created) editRoom(created);
    }
    setStatus(
      n === 1 ? lengthDup ? `1 kopie van \xAB${copyLabelBase(room.label)}\xBB \u2014 sleep de groene lijn of ankers naar de juiste plaats; daarna opslaan` : `1 kopie geplaatst naast \xAB${copyLabelBase(room.label)}\xBB \u2014 sleep het groene vlak of witte ankers; pijltjes om te schuiven; daarna opslaan` : `${n} kopie\xEBn rond \xAB${copyLabelBase(room.label)}\xBB \u2014 klik een kopie in de lijst om te slepen`,
      "ok"
    );
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  }
}
async function duplicateFromPending(count) {
  if (!pendingRoom || !activeSection) {
    setStatus("Sluit eerst een polygoon (of selecteer een opgeslagen component)", "err");
    return;
  }
  const kierDup = !isFloormapKind() && (selectedIsKierdichting() || pendingIsLengthComponent());
  if (!pendingRoom.closed && !kierDup) {
    setStatus("Sluit eerst een polygoon (of selecteer een opgeslagen component)", "err");
    return;
  }
  const n = count ?? promptCopyCount(1);
  if (n == null) return;
  const snapPoints = pendingRoom.points.map((p) => ({ ...p }));
  const snapHoles = (pendingRoom.holes || []).map((h) => h.map((p) => ({ ...p })));
  const editingId = pendingRoom.editingId;
  let analysis = null;
  if (editingId) {
    const src = rooms.find((r) => r.id === editingId);
    analysis = src?.analysis ?? null;
  }
  if (!analysis && !isFloormapKind()) {
    const mat = selectedCatalogMaterial();
    if (mat) {
      analysis = {
        material_id: mat.material_id,
        master_category: mat.master_category,
        material_name: mat.name,
        catalog_id: mat.catalog_id,
        category: mat.category || void 0,
        rubriek_nr: mat.rubriek_nr ?? void 0
      };
    }
  }
  if (isFloormapKind()) {
    const oris = readExpectedOrientaties();
    analysis = {
      ...analysis || {},
      expected_orientaties: oris,
      orientatie_correcties: readOrientatieCorrecties()
    };
  }
  if (kierDup) {
    analysis = {
      ...analysis || {},
      quantity_kind: "length"
    };
    if (!pendingRoom.closed) analysis.open_path = true;
  }
  const vgVr = parseVgVrInputs();
  if (vgVr.error) {
    setStatus(vgVr.error, "err");
    return;
  }
  if (isFloormapKind() && (vgVr.vg_nr == null || vgVr.vr_nr == null)) {
    setStatus("Vul VG- en VR-nummer in v\xF3\xF3r dupliceren", "err");
    return;
  }
  if (isFloormapKind() && !readExpectedOrientaties().length) {
    setStatus(
      "Vink minstens \xE9\xE9n gevelori\xEBntatie aan v\xF3\xF3r dupliceren",
      "err"
    );
    expectedOriBlockEl?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    return;
  }
  const label = roomLabelInput.value.trim() || `${activePartNoun().singular.charAt(0).toUpperCase() + activePartNoun().singular.slice(1)} ${rooms.length + 1}`;
  const level = roomLevelSelect.value || "OTHER";
  const vg = vgVr.vg_nr;
  const vr = vgVr.vr_nr;
  setStatus(`Kopi\xEBren (${n})\u2026`, "busy");
  try {
    if (!editingId) {
      await savePendingRoom();
    }
    const lastId = await duplicateClosedComponent({
      points: snapPoints,
      holes: snapHoles,
      label,
      level_hint: level,
      vg_nr: vg,
      vr_nr: vr,
      analysis,
      count: n,
      offsetMode: kierDup ? "nudge" : "around"
    });
    await loadRooms();
    if (lastId) {
      const created = rooms.find((r) => r.id === lastId);
      if (created) editRoom(created);
    }
    setStatus(
      n === 1 ? "1 kopie geplaatst \u2014 sleep het groene vlak of witte ankers; pijltjes om te schuiven; daarna opslaan" : `${n} kopie\xEBn geplaatst \u2014 klik een kopie in de lijst om te slepen`,
      "ok"
    );
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
    syncPendingRoomButtons();
  }
}
function syncPendingGeometryToRooms() {
  if (!pendingRoom?.editingId || !pendingRoom.points.length) return;
  const id = pendingRoom.editingId;
  const i = rooms.findIndex((r) => r.id === id);
  if (i < 0) return;
  const prev = rooms[i];
  const holes = (pendingRoom.holes || []).map((h) => h.map((p) => ({ ...p })));
  const next = {
    ...prev,
    points: pendingRoom.points.map((p) => ({ ...p })),
    label: (pendingRoom.label || roomLabelInput.value).trim() || prev.label,
    level_hint: roomLevelSelect.value || prev.level_hint,
    analysis: {
      ...prev.analysis || {},
      holes: holes.length ? holes : void 0,
      open_path: pendingRoom.closed ? void 0 : true
    }
  };
  if (pendingRoom.closed) {
    if (next.analysis) delete next.analysis.open_path;
  }
  rooms[i] = next;
  noteLocalRoomPatch(next);
}
function editRoom(room) {
  if (pendingRoom?.editingId && pendingRoom.editingId !== room.id) {
    syncPendingGeometryToRooms();
  }
  endDiscovery();
  endCalibrate();
  if (measure.tool !== "off") clearMeasure(false);
  if (activeSection && !(activeSection.metres_per_norm_unit != null && activeSection.metres_per_norm_unit > 0) && room.metres_per_norm_unit != null && room.metres_per_norm_unit > 0) {
    activeSection.metres_per_norm_unit = room.metres_per_norm_unit;
    if (!activeSection.scale_source || activeSection.scale_source === "NONE") {
      activeSection.scale_source = "CALIBRATED";
    }
    updateScaleUi();
  }
  const holes = Array.isArray(room.analysis?.holes) ? room.analysis.holes.map((h) => coerceRingPoints(h)).filter((h) => h.length >= 3) : [];
  const asOpen = Boolean(room.analysis?.open_path) || Boolean(room.analysis?.quantity_kind === "length") && room.points.length >= 2 && Math.hypot(
    room.points[0].x - room.points[room.points.length - 1].x,
    room.points[0].y - room.points[room.points.length - 1].y
  ) > 1e-4;
  pendingRoom = {
    points: asOpen ? clampPath(room.points.map((p) => ({ ...p }))) : closeRing(room.points.map((p) => ({ ...p }))),
    holes: asOpen ? [] : holes,
    closed: !asOpen,
    editingId: room.id,
    dragVertex: null,
    dragBodyLast: null,
    drawing: false,
    drawCursor: null,
    label: (room.label || "").trim()
  };
  roomLabelInput.value = pendingRoom.label || room.label;
  roomLevelSelect.value = room.level_hint || "OTHER";
  if (room.vg_nr != null) {
    roomVgInput.value = String(room.vg_nr);
  } else if (isFloormapKind()) {
    roomVgInput.value = "";
  } else if (!roomVgInput.value.trim()) {
    roomVgInput.value = String(suggestVgNr());
  }
  if (room.vr_nr != null && String(room.vr_nr).trim()) {
    roomVrInput.value = String(room.vr_nr).trim();
  } else if (isFloormapKind()) {
    roomVrInput.value = "";
  } else if (!roomVrInput.value.trim()) {
    roomVrInput.value = suggestFacadeVrNr();
  }
  if (isFloormapKind()) {
    setExpectedOrientaties(
      room.analysis?.expected_orientaties,
      room.analysis?.orientatie_correcties
    );
    clearComponentOrientatie();
  } else {
    clearExpectedOrientaties();
    applyComponentOrientatieForEdit(room.analysis?.orientatie);
  }
  void applyMaterialSelectionFromAnalysis(room.analysis);
  syncPendingRoomButtons();
  syncEditDock();
  syncToolButtons();
  updateMeasureReadouts();
  updateToolHint();
  renderRoomList();
  drawOverlay();
  requestAnimationFrame(() => {
    if (isFloormapKind() && expectedOriBlockEl && !expectedOriBlockEl.classList.contains("hidden")) {
      expectedOriBlockEl.classList.add("fm-expected-ori-block--focus");
      expectedOriBlockEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
      window.setTimeout(() => expectedOriBlockEl?.classList.remove("fm-expected-ori-block--focus"), 1400);
    }
    if (pendingRoom?.editingId === room.id && pendingRoom.points.length) {
      scrollToRing(pendingRoom.points);
    }
  });
  const oriN = isFloormapKind() ? readExpectedOrientaties().length : 0;
  setStatus(
    isFloormapKind() ? `Bewerken: ${room.label} \u2014 gevelori\xEBntaties${oriN ? ` (${oriN})` : ""} bovenaan in de zijbalk aanpassen, daarna Opslaan` : `Bewerken: ${room.label} \u2014 sleep ankers; dubbelklik op een rand voor extra hoekpunt; daarna opslaan`,
    "ok"
  );
}
async function applyMaterialSelectionFromAnalysis(a) {
  if (isFloormapKind() || !materialCategoryEl) return;
  await ensureMaterialCategories();
  const master = (a?.master_category || "").trim();
  const sub = (a?.category || "").trim();
  const mid = (a?.material_id || "").trim();
  if (materialFilterEl) materialFilterEl.value = "";
  if (!master) {
    materialCategoryEl.value = "";
    renderMaterialSubcategoryOptions();
    catalogMaterials = [];
    renderMaterialNameOptions([]);
    updateMaterialSpectrumPreview(null);
    return;
  }
  if (![...materialCategoryEl.options].some((o) => o.value === master)) {
    const opt = document.createElement("option");
    opt.value = master;
    opt.textContent = master;
    materialCategoryEl.appendChild(opt);
  }
  materialCategoryEl.value = master;
  renderMaterialSubcategoryOptions();
  if (materialSubcategoryEl) materialSubcategoryEl.value = "";
  await loadMaterialsForCategory(master, "");
  if (mid) renderMaterialNameOptions(catalogMaterials, mid);
  if (sub && materialSubcategoryEl) {
    if (![...materialSubcategoryEl.options].some((o) => o.value === sub)) {
      const opt = document.createElement("option");
      opt.value = sub;
      opt.textContent = sub;
      materialSubcategoryEl.appendChild(opt);
    }
    materialSubcategoryEl.value = sub;
  }
  syncPendingRoomButtons();
  updateMaterialQuantityHint();
  updateMaterialSpectrumPreview();
}
async function defaultMaterialFromDifferenceSubject() {
  if (isFloormapKind()) return;
  const selected = rooms.filter((r) => selectedSetIds.has(r.id));
  if (!selected.length) return;
  const subj = differenceSubject(selected);
  if (!subj?.analysis?.material_id && !subj?.analysis?.master_category) return;
  await applyMaterialSelectionFromAnalysis(subj.analysis);
}
function catalogMaterialFromAnalysis(a) {
  const mid = (a?.material_id || "").trim();
  const master = (a?.master_category || "").trim();
  const name = (a?.material_name || a?.material_kind || "").trim();
  if (!mid || !master || !name) return null;
  const fromCat = catalogMaterials.find((m) => m.material_id === mid);
  if (fromCat) return fromCat;
  return {
    material_id: mid,
    catalog_id: (a?.catalog_id || "").trim(),
    material_no: 0,
    master_category: master,
    name,
    category: (a?.category || "").trim(),
    thickness_mm: null,
    ra_dba: null
  };
}
function updateBooleanPreview() {
  booleanPreview = null;
  if (isFloormapKind() || selectedSetIds.size < 2) {
    renderComposeParts();
    drawOverlay();
    return;
  }
  if (setOpsFieldset instanceof HTMLDetailsElement && !setOpsFieldset.open) {
    setOpsFieldset.open = true;
    try {
      localStorage.setItem("app-gevelwering-compose-collapsed", "0");
    } catch {
    }
  }
  try {
    const selected = rooms.filter((r) => selectedSetIds.has(r.id));
    const { parts } = buildComposeParts(selected);
    booleanPreview = composeSigned(parts.map((p) => ({ ring: p.room.points, sign: p.sign })));
    if (composeFeedbackEl?.classList.contains("is-err")) {
      setComposeFeedback("", "clear");
    }
  } catch (err) {
    booleanPreview = null;
    const msg = err instanceof Error ? err.message : String(err);
    setComposeFeedback(msg, "err");
  }
  renderComposeParts();
  drawOverlay();
}
function materialAnalysisLabel(a, opts) {
  if (!a) return "";
  const op = opts?.skipOp ? "" : booleanOpSymbol(a.boolean_op);
  const code = (a.catalog_id || "").trim();
  const name = a.material_name || a.material_kind || "";
  const mat = code && name ? `${code} \xB7 ${name}` : code || name;
  const cat = a.master_category || "";
  if (mat && cat) return `${op} ${cat}: ${mat}`.trim();
  if (mat) return `${op} ${mat}`.trim();
  if (cat) return `${op} ${cat}`.trim();
  return op;
}
function selectedCatalogMaterial() {
  const id = (materialIdEl?.value || materialFavoriteEl?.value || "").trim();
  if (!id) return null;
  return catalogMaterials.find((m) => m.material_id === id) || favoriteMaterials.find((m) => m.material_id === id) || null;
}
function fmtSpectrumDb(v) {
  if (v == null || !Number.isFinite(Number(v))) return "\u2014";
  const n = Number(v);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
function updateMaterialSpectrumPreview(mat) {
  if (!materialSpectrumEl) return;
  const m = mat === void 0 ? selectedCatalogMaterial() : mat;
  if (!m) {
    materialSpectrumEl.classList.add("hidden");
    if (materialR125El) materialR125El.textContent = "\u2014";
    if (materialR250El) materialR250El.textContent = "\u2014";
    if (materialR500El) materialR500El.textContent = "\u2014";
    if (materialR1000El) materialR1000El.textContent = "\u2014";
    if (materialR2000El) materialR2000El.textContent = "\u2014";
    if (materialRaEl) materialRaEl.textContent = "\u2014";
    return;
  }
  if (materialR125El) materialR125El.textContent = fmtSpectrumDb(m.r_125_hz);
  if (materialR250El) materialR250El.textContent = fmtSpectrumDb(m.r_250_hz);
  if (materialR500El) materialR500El.textContent = fmtSpectrumDb(m.r_500_hz);
  if (materialR1000El) materialR1000El.textContent = fmtSpectrumDb(m.r_1000_hz);
  if (materialR2000El) materialR2000El.textContent = fmtSpectrumDb(m.r_2000_hz);
  if (materialRaEl) materialRaEl.textContent = fmtSpectrumDb(m.ra_dba);
  materialSpectrumEl.classList.remove("hidden");
}
function renderMaterialCategoryOptions(categories) {
  if (!materialCategoryEl) return;
  const keep = materialCategoryEl.value;
  materialCategoryMeta = categories;
  materialCategoryEl.replaceChildren();
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = "\u2014 kies rubriek \u2014";
  materialCategoryEl.appendChild(ph);
  for (const c of categories) {
    const opt = document.createElement("option");
    opt.value = c.master_category;
    opt.textContent = `${c.label || c.master_category} (${c.material_count})`;
    materialCategoryEl.appendChild(opt);
  }
  if (keep && categories.some((c) => c.master_category === keep)) {
    materialCategoryEl.value = keep;
  }
  renderMaterialSubcategoryOptions();
}
function renderMaterialSubcategoryOptions() {
  if (!materialSubcategoryEl) return;
  const master = (materialCategoryEl?.value || "").trim();
  const meta = materialCategoryMeta.find((c) => c.master_category === master);
  const keep = materialSubcategoryEl.value;
  materialSubcategoryEl.replaceChildren();
  const all = document.createElement("option");
  all.value = "";
  all.textContent = "0 - Alle subrubrieken";
  materialSubcategoryEl.appendChild(all);
  const subs = meta?.subrubrieken || [];
  for (const s of subs) {
    const opt = document.createElement("option");
    opt.value = s.category;
    opt.textContent = s.label || `${s.subrubriek_nr} - ${s.category}`;
    materialSubcategoryEl.appendChild(opt);
  }
  materialSubcategoryEl.disabled = !master;
  if (keep && subs.some((s) => s.category === keep)) {
    materialSubcategoryEl.value = keep;
  } else {
    materialSubcategoryEl.value = "";
  }
}
function renderMaterialNameOptions(materials, selectedId) {
  if (!materialIdEl) return;
  materialIdEl.replaceChildren();
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = materials.length ? "\u2014 kies materiaal \u2014" : "\u2014 geen materialen \u2014";
  materialIdEl.appendChild(ph);
  for (const m of materials) {
    const opt = document.createElement("option");
    opt.value = m.material_id;
    const code = (m.catalog_id || "").trim();
    const ra = m.ra_dba != null ? ` \xB7 RA ${m.ra_dba}` : "";
    const sub = m.category ? ` \xB7 ${m.category}` : "";
    const opbouw = materialKindInline(m.material_kind);
    const appBit = (m.source || "").trim().toLowerCase() === "app" || (m.source || "").trim().toLowerCase() === "eigen" ? " \xB7 app" : "";
    opt.textContent = code ? `${code} \xB7 ${m.name}${sub} \xB7 ${opbouw}${ra}${appBit}` : `${m.name}${sub} \xB7 ${opbouw}${ra}${appBit}`;
    opt.title = code ? `${code} \xB7 ${m.name} (${opbouw})` : `${m.name} (${opbouw})`;
    materialIdEl.appendChild(opt);
  }
  materialIdEl.disabled = materials.length === 0;
  if (selectedId && materials.some((m) => m.material_id === selectedId)) {
    materialIdEl.value = selectedId;
  }
  syncFavoriteButtons();
}
function renderFavoriteOptions(selectedId) {
  if (!materialFavoriteEl) return;
  const keep = selectedId ?? materialFavoriteEl.value;
  materialFavoriteEl.replaceChildren();
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = favoriteMaterials.length ? "\u2014 kies uit meest gebruikt \u2014" : "\u2014 geen favorieten voor dit project \u2014";
  materialFavoriteEl.appendChild(ph);
  for (const m of favoriteMaterials) {
    const opt = document.createElement("option");
    opt.value = m.material_id;
    const code = (m.catalog_id || "").trim();
    const ra = m.ra_dba != null ? ` \xB7 RA ${m.ra_dba}` : "";
    opt.textContent = code ? `${code} \xB7 ${m.name}${ra}` : `${m.name}${ra}`;
    materialFavoriteEl.appendChild(opt);
  }
  materialFavoriteEl.disabled = favoriteMaterials.length === 0;
  if (keep && favoriteMaterials.some((m) => m.material_id === keep)) {
    materialFavoriteEl.value = keep;
  }
  syncFavoriteButtons();
}
function syncFavoriteButtons() {
  const hasBuilding = Boolean(buildingId);
  const mid = (materialIdEl?.value || materialFavoriteEl?.value || "").trim();
  const isFav = Boolean(mid && favoriteMaterials.some((m) => m.material_id === mid));
  if (favoriteAddBtn) favoriteAddBtn.disabled = !hasBuilding || !mid || isFav;
  if (favoriteRemoveBtn) favoriteRemoveBtn.disabled = !hasBuilding || !isFav;
  if (presetSaveBtn) presetSaveBtn.disabled = !hasBuilding || favoriteMaterials.length === 0;
  if (presetApplyBtn) presetApplyBtn.disabled = !hasBuilding;
}
async function loadFavoriteMaterials() {
  if (!auth()?.token || !buildingId) {
    favoriteMaterials = [];
    renderFavoriteOptions();
    return;
  }
  try {
    const data = bppPhase1Enabled() ? await bppListMaterialFavorites(invokeString, auth().token, buildingId) : await apiGet(
      `/api/floormap/material-favorites?building_id=${encodeURIComponent(buildingId)}`
    );
    favoriteMaterials = data.materials || [];
    renderFavoriteOptions(materialIdEl?.value || null);
  } catch (err) {
    favoriteMaterials = [];
    renderFavoriteOptions();
    console.warn("load favorites failed", err);
  }
}
async function addMaterialFavorite(materialId) {
  if (!auth()?.token || !buildingId || !materialId) return;
  if (bppPhase1Enabled()) {
    await bppAddMaterialFavorite(invokeString, auth().token, buildingId, materialId);
  } else {
    await apiPost("/api/floormap/material-favorites", {
      building_id: buildingId,
      material_id: materialId
    });
  }
  await loadFavoriteMaterials();
  setStatus("Toegevoegd aan meest gebruikt", "ok");
}
async function removeMaterialFavorite(materialId) {
  if (!auth()?.token || !buildingId || !materialId) return;
  if (bppPhase1Enabled()) {
    await bppRemoveMaterialFavorite(invokeString, auth().token, buildingId, materialId);
  } else {
    await apiDelete(
      `/api/floormap/material-favorites?building_id=${encodeURIComponent(buildingId)}&material_id=${encodeURIComponent(materialId)}`
    );
  }
  await loadFavoriteMaterials();
  setStatus("Verwijderd uit meest gebruikt", "ok");
}
function ensureMaterialOption(mat) {
  if (!catalogMaterials.some((m) => m.material_id === mat.material_id)) {
    catalogMaterials = [mat, ...catalogMaterials];
  }
  if (!materialIdEl) return;
  if (![...materialIdEl.options].some((o) => o.value === mat.material_id)) {
    renderMaterialNameOptions(catalogMaterials, mat.material_id);
  }
  materialIdEl.value = mat.material_id;
  materialIdEl.disabled = false;
}
async function selectMaterialById(materialId, fromFavorite = false) {
  const mat = favoriteMaterials.find((m) => m.material_id === materialId) || catalogMaterials.find((m) => m.material_id === materialId);
  if (!mat) {
    setStatus("Materiaal niet gevonden in meest gebruikt", "err");
    return;
  }
  if (materialFilterEl) materialFilterEl.value = "";
  if (mat.master_category && materialCategoryEl) {
    await ensureMaterialCategories();
    if (![...materialCategoryEl.options].some((o) => o.value === mat.master_category)) {
      const opt = document.createElement("option");
      opt.value = mat.master_category;
      opt.textContent = mat.master_category;
      materialCategoryEl.appendChild(opt);
    }
    materialCategoryEl.value = mat.master_category;
    renderMaterialSubcategoryOptions();
    if (materialSubcategoryEl) materialSubcategoryEl.value = "";
    await loadMaterialsForCategory(mat.master_category, "");
  }
  ensureMaterialOption(mat);
  if (mat.category && materialSubcategoryEl) {
    if (![...materialSubcategoryEl.options].some((o) => o.value === mat.category)) {
      const opt = document.createElement("option");
      opt.value = mat.category;
      opt.textContent = mat.category;
      materialSubcategoryEl.appendChild(opt);
    }
    materialSubcategoryEl.value = mat.category;
  }
  if (fromFavorite && materialFavoriteEl) materialFavoriteEl.value = materialId;
  updateMaterialSpectrumPreview(mat);
  syncFavoriteButtons();
  syncPendingRoomButtons();
  updateMaterialQuantityHint();
  fillReplaceToSelect(mat.material_id);
  updateReplaceMaterialBtn();
  await applyMaterialToEditingComponent(mat);
}
var projectMaterialUsages = null;
var projectMaterialUsagesLoading = false;
function materialUsageLabel(u) {
  const code = (u.catalog_id || "").trim();
  const name = (u.material_name || "").trim();
  const base = code && name ? `${code} \xB7 ${name}` : name || code || u.material_id.slice(0, 8);
  return `${base} \xB7 ${u.count}\xD7`;
}
async function collectProjectMaterialUsages() {
  if (!auth()?.token || !buildingId) return [];
  const byId = /* @__PURE__ */ new Map();
  for (const s of sections) {
    if (isFloormapKind(s.region_kind)) continue;
    if ((s.room_count || 0) < 1 && s.id !== activeSection?.id) continue;
    let list;
    try {
      list = s.id === activeSection?.id ? rooms : await fetchSectionRooms(s.id);
    } catch {
      continue;
    }
    for (const r of list) {
      if (isLegacySealSibling(r.analysis)) continue;
      const mid = String(r.analysis?.material_id || "").trim();
      if (!mid) continue;
      const cur = byId.get(mid);
      if (cur) {
        cur.count += 1;
        cur.subsection_ids.push(r.id);
        continue;
      }
      byId.set(mid, {
        material_id: mid,
        catalog_id: String(r.analysis?.catalog_id || "").trim(),
        material_name: String(r.analysis?.material_name || "").trim(),
        master_category: String(r.analysis?.master_category || "").trim(),
        category: String(r.analysis?.category || "").trim(),
        count: 1,
        subsection_ids: [r.id]
      });
    }
  }
  return [...byId.values()].sort((a, b) => {
    const la = `${a.catalog_id} ${a.material_name}`.trim();
    const lb = `${b.catalog_id} ${b.material_name}`.trim();
    return la.localeCompare(lb, "nl") || b.count - a.count;
  });
}
async function refreshProjectMaterialUsages(force = false) {
  if (!auth()?.token || !buildingId || projectMaterialUsagesLoading) return;
  if (!force && projectMaterialUsages) {
    syncReplaceMaterialUi();
    return;
  }
  projectMaterialUsagesLoading = true;
  try {
    projectMaterialUsages = await collectProjectMaterialUsages();
  } finally {
    projectMaterialUsagesLoading = false;
  }
  syncReplaceMaterialUi();
}
function replaceToCandidateMaterials() {
  const byId = /* @__PURE__ */ new Map();
  for (const m of favoriteMaterials) byId.set(m.material_id, m);
  for (const m of catalogMaterials) byId.set(m.material_id, m);
  const sel = selectedCatalogMaterial();
  if (sel) byId.set(sel.material_id, sel);
  const fromId = (replaceMatFromEl?.value || "").trim();
  const fromUsage = projectMaterialUsages?.find((u) => u.material_id === fromId);
  const fromCat = (fromUsage?.category || materialSubcategoryEl?.value || "").trim().toLowerCase();
  return [...byId.values()].sort((a, b) => {
    const aSame = fromCat && (a.category || "").trim().toLowerCase() === fromCat ? 0 : 1;
    const bSame = fromCat && (b.category || "").trim().toLowerCase() === fromCat ? 0 : 1;
    if (aSame !== bSame) return aSame - bSame;
    const aApp = (a.source || "") === "app" || (a.catalog_id || "").startsWith("A") ? 0 : 1;
    const bApp = (b.source || "") === "app" || (b.catalog_id || "").startsWith("A") ? 0 : 1;
    if (aApp !== bApp) return aApp - bApp;
    const la = `${a.catalog_id || ""} ${a.name || ""}`.trim();
    const lb = `${b.catalog_id || ""} ${b.name || ""}`.trim();
    return la.localeCompare(lb, "nl");
  });
}
function formatReplaceToOption(m) {
  const code = (m.catalog_id || "").trim();
  const name = (m.name || "").trim();
  const ra = m.ra_dba != null && Number.isFinite(Number(m.ra_dba)) ? ` \xB7 RA ${m.ra_dba}` : "";
  return (code && name ? `${code} \xB7 ${name}` : name || code || m.material_id.slice(0, 8)) + ra;
}
function resolveReplaceToMaterial() {
  const id = (replaceMatToEl?.value || "").trim();
  if (!id) return null;
  return catalogMaterials.find((m) => m.material_id === id) || favoriteMaterials.find((m) => m.material_id === id) || null;
}
function fillReplaceToSelect(preferId) {
  if (!replaceMatToEl) return;
  const prev = (preferId || replaceMatToEl.value || selectedCatalogMaterial()?.material_id || "").trim();
  const fromId = (replaceMatFromEl?.value || "").trim();
  const list = replaceToCandidateMaterials().filter((m) => m.material_id !== fromId);
  replaceMatToEl.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = list.length ? "\u2014 kies nieuw materiaal \u2014" : "\u2014 kies eerst een rubriek hierboven \u2014";
  replaceMatToEl.appendChild(ph);
  for (const m of list) {
    const opt = document.createElement("option");
    opt.value = m.material_id;
    opt.textContent = formatReplaceToOption(m);
    replaceMatToEl.appendChild(opt);
  }
  if (prev && list.some((m) => m.material_id === prev)) {
    replaceMatToEl.value = prev;
  }
}
async function ensureReplaceToCatalogForFrom() {
  const fromId = (replaceMatFromEl?.value || "").trim();
  const usage = projectMaterialUsages?.find((u) => u.material_id === fromId);
  const master = (usage?.master_category || materialCategoryEl?.value || "").trim();
  let sub = (usage?.category || "").trim();
  if (!master || !auth()?.token) {
    fillReplaceToSelect();
    updateReplaceMaterialBtn();
    return;
  }
  try {
    await ensureMaterialCategories();
    if (materialCategoryEl && materialCategoryEl.value !== master) {
      if (![...materialCategoryEl.options].some((o) => o.value === master)) {
        const opt = document.createElement("option");
        opt.value = master;
        opt.textContent = master;
        materialCategoryEl.appendChild(opt);
      }
      materialCategoryEl.value = master;
      renderMaterialSubcategoryOptions();
    } else {
      renderMaterialSubcategoryOptions();
    }
    if (!sub && usage) {
      const q = (usage.catalog_id || usage.material_name || "").trim();
      if (q) {
        const probe = bppPhase1Enabled() ? await bppListMaterials(invokeString, auth().token, {
          master_category: master,
          q,
          limit: 20
        }) : await apiGet(
          `/api/floormap/materials?${new URLSearchParams({
            limit: "20",
            master_category: master,
            q
          }).toString()}`
        );
        const hit = (probe.materials || []).find((m) => m.material_id === fromId) || (probe.materials || []).find(
          (m) => (m.catalog_id || "").trim() === (usage.catalog_id || "").trim()
        );
        if (hit?.category) {
          sub = hit.category.trim();
          usage.category = sub;
        }
      }
    }
    if (materialSubcategoryEl) {
      if (sub) {
        if (![...materialSubcategoryEl.options].some((o) => o.value === sub)) {
          const opt = document.createElement("option");
          opt.value = sub;
          opt.textContent = sub;
          materialSubcategoryEl.appendChild(opt);
        }
        materialSubcategoryEl.value = sub;
      } else {
        materialSubcategoryEl.value = "";
      }
    }
    await loadMaterialsForCategory(master, "");
  } catch {
  }
  fillReplaceToSelect();
  updateReplaceMaterialBtn();
}
function syncReplaceMaterialUi() {
  if (!replaceMatEl) return;
  const show = Boolean(activeSection && !isFloormapKind() && buildingId);
  replaceMatEl.classList.toggle("hidden", !show);
  if (!show) {
    if (replaceMatCb) replaceMatCb.checked = false;
    replaceMatControlsEl?.classList.add("hidden");
    if (replaceMatBtn) replaceMatBtn.disabled = true;
    return;
  }
  const open = Boolean(replaceMatCb?.checked);
  replaceMatControlsEl?.classList.toggle("hidden", !open);
  if (open && !projectMaterialUsages && !projectMaterialUsagesLoading) {
    void refreshProjectMaterialUsages(true);
  }
  if (!replaceMatFromEl) return;
  const prev = replaceMatFromEl.value;
  const usages = projectMaterialUsages || [];
  replaceMatFromEl.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = projectMaterialUsagesLoading ? "\u2014 laden\u2026 \u2014" : usages.length ? "\u2014 kies te vervangen materiaal \u2014" : "\u2014 nog geen materialen op gevels \u2014";
  replaceMatFromEl.appendChild(ph);
  for (const u of usages) {
    const opt = document.createElement("option");
    opt.value = u.material_id;
    opt.textContent = materialUsageLabel(u);
    replaceMatFromEl.appendChild(opt);
  }
  if (prev && usages.some((u) => u.material_id === prev)) {
    replaceMatFromEl.value = prev;
  }
  fillReplaceToSelect();
  updateReplaceMaterialBtn();
}
function updateReplaceMaterialBtn() {
  if (!replaceMatBtn) return;
  const fromId = (replaceMatFromEl?.value || "").trim();
  const to = resolveReplaceToMaterial();
  const usage = projectMaterialUsages?.find((u) => u.material_id === fromId);
  const ok = Boolean(replaceMatCb?.checked) && Boolean(fromId) && Boolean(to?.material_id) && Boolean(usage?.count) && to.material_id !== fromId;
  replaceMatBtn.disabled = !ok;
  if (replaceMatHintEl) {
    if (!fromId) {
      replaceMatHintEl.textContent = "Kies \xABVan\xBB (huidig op gevels) en \xABNaar\xBB (vervanging). Alle componenten met Van worden omgezet.";
    } else if (!to) {
      replaceMatHintEl.textContent = `\xABVan\xBB geselecteerd (${usage?.count || 0}\xD7). Kies hieronder \xABNaar\xBB.`;
    } else if (to.material_id === fromId) {
      replaceMatHintEl.textContent = "Van en Naar moeten verschillen.";
    } else {
      const fromLabel = [usage?.catalog_id, usage?.material_name].filter(Boolean).join(" \xB7 ") || fromId.slice(0, 8);
      const toLabel = [to.catalog_id, to.name].filter(Boolean).join(" \xB7 ") || to.name;
      replaceMatHintEl.textContent = `Vervangt ${usage?.count || 0}\xD7 \xAB${fromLabel}\xBB door \xAB${toLabel}\xBB op alle gevels in dit project.`;
    }
  }
  if (ok && usage) {
    replaceMatBtn.textContent = `Vervang ${usage.count}\xD7 in project`;
  } else {
    replaceMatBtn.textContent = "Vervangen\u2026";
  }
}
function clearLocalRoomPatch(id) {
  const sid = normRoomId(id);
  if (!sid) return;
  localRoomPatches.delete(sid);
  localRoomPatches.delete(id);
}
function labelAfterMaterialSwap(label, fromCatalogId, fromName, to) {
  let out = (label || "").trim();
  if (!out) return out;
  const toCat = (to.catalog_id || "").trim();
  const toName = (to.name || "").trim();
  const fromCat = (fromCatalogId || "").trim();
  const fromMat = (fromName || "").trim();
  if (fromCat && toCat && out.includes(fromCat)) out = out.split(fromCat).join(toCat);
  if (fromMat && toName && out.includes(fromMat)) out = out.split(fromMat).join(toName);
  return out;
}
function applyMaterialSwapToRoom(room, to, fromCatalogId, fromName) {
  const prev = room.analysis && typeof room.analysis === "object" ? { ...room.analysis } : {};
  const nextLabel = labelAfterMaterialSwap(room.label || "", fromCatalogId, fromName, to);
  const labelChanged = nextLabel !== (room.label || "").trim();
  const next = {
    ...room,
    label: labelChanged ? nextLabel : room.label,
    analysis: {
      ...prev,
      material_id: to.material_id,
      catalog_id: to.catalog_id || prev.catalog_id,
      material_name: to.name,
      master_category: to.master_category || prev.master_category,
      category: to.category || prev.category,
      rubriek_nr: to.rubriek_nr ?? prev.rubriek_nr,
      ra_dba: to.ra_dba ?? prev.ra_dba
    }
  };
  return { room: next, labelChanged };
}
async function replaceMaterialInProject() {
  if (!auth()?.token || !buildingId) {
    setStatus("Geen project geladen", "err");
    return;
  }
  const fromId = (replaceMatFromEl?.value || "").trim();
  const to = resolveReplaceToMaterial();
  if (!fromId || !to) {
    setStatus("Kies \xABVan\xBB en \xABNaar\xBB", "err");
    return;
  }
  if (to.material_id === fromId) {
    setStatus("Van en Naar moeten verschillen", "err");
    return;
  }
  const usage = projectMaterialUsages?.find((u) => u.material_id === fromId);
  if (!usage?.subsection_ids.length) {
    setStatus("Geen componenten met dat materiaal gevonden", "err");
    return;
  }
  const fromLabel = [usage.catalog_id, usage.material_name].filter(Boolean).join(" \xB7 ") || fromId.slice(0, 8);
  const toLabel = [to.catalog_id, to.name].filter(Boolean).join(" \xB7 ") || to.name;
  const ok = window.confirm(
    `${usage.count} gevelcomponent(en) in dit project:

\xAB${fromLabel}\xBB \u2192 \xAB${toLabel}\xBB

Doorgaan? (kierdichting-kenmerk blijft ongewijzigd)`
  );
  if (!ok) {
    setStatus("Vervangen geannuleerd", "err");
    return;
  }
  if (replaceMatBtn) replaceMatBtn.disabled = true;
  let done = 0;
  const failed = [];
  const replacedIds = new Set(usage.subsection_ids.map((id) => normRoomId(id)));
  try {
    for (let i = 0; i < usage.subsection_ids.length; i++) {
      const sid = usage.subsection_ids[i];
      setStatus(`Materiaal vervangen ${i + 1}/${usage.count}\u2026`, "busy");
      try {
        if (bppPhase1Enabled()) {
          await bppSaveSubsectionMaterial(invokeString, auth().token, sid, to.material_id);
        } else {
          await apiPost("/api/floormap/subsection-material", {
            subsection_id: sid,
            material_id: to.material_id
          });
        }
        clearLocalRoomPatch(sid);
        done += 1;
      } catch (err) {
        failed.push(`${sid.slice(0, 8)}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (activeSection) sectionRoomsSnapshot.delete(activeSection.id);
    for (const sid of usage.subsection_ids) clearLocalRoomPatch(sid);
    projectMaterialUsages = null;
    if (activeSection && !isFloormapKind()) {
      try {
        await loadRooms({ preserveOrder: true });
      } catch {
      }
    }
    const mpu = activeScaleMpu();
    const aspect = activeScaleAspect();
    const labelChangedIds = /* @__PURE__ */ new Set();
    rooms = rooms.map((r) => {
      if (!replacedIds.has(normRoomId(r.id))) return r;
      const { room: next, labelChanged } = applyMaterialSwapToRoom(
        r,
        to,
        usage.catalog_id,
        usage.material_name
      );
      if (labelChanged) labelChangedIds.add(normRoomId(next.id));
      noteLocalRoomPatch(next);
      markRoomTouched(next.id);
      return next;
    });
    if (labelChangedIds.size > 0 && activeSection && auth()?.token) {
      setStatus(`Labels bijwerken (${labelChangedIds.size})\u2026`, "busy");
      for (const r of rooms) {
        if (!labelChangedIds.has(normRoomId(r.id))) continue;
        const holes = Array.isArray(r.analysis?.holes) ? r.analysis.holes.map((h) => coerceRingPoints(h)).filter((h) => h.length >= 3) : [];
        try {
          await saveDrawingSubsection({
            section_id: activeSection.id,
            subsection_id: r.id,
            label: r.label,
            level_hint: r.level_hint || "OTHER",
            vg_nr: r.vg_nr,
            vr_nr: r.vr_nr,
            points: r.points,
            holes,
            metres_per_norm_unit: mpu ?? void 0,
            scale_aspect_yx: aspect,
            analysis: r.analysis || void 0
          });
        } catch {
        }
      }
    }
    renderRoomList();
    drawOverlay();
    await refreshProjectMaterialUsages(true);
    if (replaceMatCb) replaceMatCb.checked = false;
    syncReplaceMaterialUi();
    if (failed.length) {
      setStatus(
        `${done} vervangen, ${failed.length} mislukt (${failed.slice(0, 2).join("; ")}${failed.length > 2 ? "\u2026" : ""})`,
        "err"
      );
    } else {
      setStatus(
        `${done} component(en): \xAB${fromLabel}\xBB \u2192 \xAB${toLabel}\xBB` + (labelChangedIds.size ? ` \xB7 ${labelChangedIds.size} label(s) bijgewerkt` : ""),
        "ok"
      );
    }
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
    syncReplaceMaterialUi();
  }
}
async function applyMaterialToEditingComponent(mat) {
  const editingId = pendingRoom?.editingId || "";
  if (!editingId || isFloormapKind() || !auth()?.token) {
    setStatus(`Materiaal \xAB${mat.name}\xBB geselecteerd`, "ok");
    return;
  }
  try {
    if (bppPhase1Enabled()) {
      await bppSaveSubsectionMaterial(invokeString, auth().token, editingId, mat.material_id);
    } else {
      await apiPost("/api/floormap/subsection-material", {
        subsection_id: editingId,
        material_id: mat.material_id
      });
    }
    const room = rooms.find((r) => r.id === editingId);
    if (room) {
      const prev = room.analysis && typeof room.analysis === "object" ? { ...room.analysis } : {};
      room.analysis = {
        ...prev,
        material_id: mat.material_id,
        catalog_id: mat.catalog_id || prev.catalog_id,
        material_name: mat.name,
        master_category: mat.master_category || prev.master_category,
        category: mat.category || prev.category,
        rubriek_nr: mat.rubriek_nr ?? prev.rubriek_nr,
        ra_dba: mat.ra_dba ?? prev.ra_dba
      };
    }
    markRoomTouched(editingId);
    renderRoomList();
    drawOverlay();
    const missing = room ? composeConstituentsMissingMaterial(room, rooms) : [];
    setStatus(
      missing.length ? `Materiaal \xAB${mat.name}\xBB toegepast \u2014 led blijft oranje tot bronnen materiaal hebben: ${missing.map((s) => s.label || "?").join(", ")}` : `Materiaal \xAB${mat.name}\xBB toegepast op component`,
      "ok"
    );
  } catch (err) {
    setStatus(
      `Materiaal geselecteerd \u2014 opslaan mislukt: ${err instanceof Error ? err.message : String(err)}`,
      "err"
    );
  }
}
async function ensureMaterialCategories() {
  if (!auth()?.token || !materialCategoryEl) return;
  if (materialCategoriesLoaded && materialCategoryEl.options.length > 1) return;
  try {
    const data = bppPhase1Enabled() ? await bppListMaterialCategories(invokeString, auth().token) : await apiGet("/api/floormap/material-categories");
    renderMaterialCategoryOptions(data.categories || []);
    materialCategoriesLoaded = true;
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  }
}
async function loadMaterialsForCategory(category, q = "") {
  if (!auth()?.token || !materialIdEl) return;
  const keep = materialIdEl.value;
  if (!category) {
    catalogMaterials = [];
    renderMaterialNameOptions([]);
    materialIdEl.disabled = true;
    updateMaterialSpectrumPreview(null);
    return;
  }
  materialIdEl.disabled = true;
  try {
    const sub = (materialSubcategoryEl?.value || "").trim();
    const data = bppPhase1Enabled() ? await bppListMaterials(invokeString, auth().token, {
      master_category: category,
      category: sub || void 0,
      q: q.trim() || void 0,
      limit: 1e3
    }) : await apiGet(
      `/api/floormap/materials?${new URLSearchParams({
        limit: "1000",
        master_category: category,
        ...sub ? { category: sub } : {},
        ...q.trim() ? { q: q.trim() } : {}
      }).toString()}`
    );
    catalogMaterials = data.materials || [];
    renderMaterialNameOptions(catalogMaterials, keep);
    updateMaterialSpectrumPreview();
    if (replaceMatCb?.checked) {
      fillReplaceToSelect();
      updateReplaceMaterialBtn();
    }
  } catch (err) {
    catalogMaterials = [];
    renderMaterialNameOptions([]);
    updateMaterialSpectrumPreview(null);
    setStatus(err instanceof Error ? err.message : String(err), "err");
  }
}
function scheduleMaterialFilterReload() {
  if (materialFilterTimer) clearTimeout(materialFilterTimer);
  materialFilterTimer = setTimeout(() => {
    const cat = (materialCategoryEl?.value || "").trim();
    const q = (materialFilterEl?.value || "").trim();
    void loadMaterialsForCategory(cat, q);
  }, 250);
}
function booleanOpSymbol(op) {
  if (op === "union") return "\u222A";
  if (op === "intersect") return "\u2229";
  if (op === "difference" || op === "compose") return "\xB1";
  return "";
}
function setComposeFeedback(text, kind = "clear") {
  if (!composeFeedbackEl) return;
  composeFeedbackEl.classList.remove("is-ok", "is-err", "is-busy");
  if (kind === "clear" || !text) {
    composeFeedbackEl.textContent = "";
    return;
  }
  composeFeedbackEl.textContent = text;
  composeFeedbackEl.classList.add(kind === "ok" ? "is-ok" : kind === "err" ? "is-err" : "is-busy");
}
async function applyBooleanSet() {
  if (!activeSection || !auth() || isFloormapKind()) return;
  if (selectedSetIds.size < 2) {
    const msg = "Selecteer minstens 2 componenten";
    setComposeFeedback(msg, "err");
    setStatus(msg, "err");
    return;
  }
  const selected = rooms.filter((r) => selectedSetIds.has(r.id));
  if (selected.length < 2) {
    const msg = "Selecteer minstens 2 componenten";
    setComposeFeedback(msg, "err");
    setStatus(msg, "err");
    return;
  }
  if (!selectedCatalogMaterial()) {
    await defaultMaterialFromDifferenceSubject();
  }
  let mat = selectedCatalogMaterial();
  if (!mat) {
    mat = catalogMaterialFromAnalysis(differenceSubject(selected)?.analysis);
  }
  if (!mat) {
    const msg = "Kies rubriek, subrubriek en materiaal (boven bij component)";
    setComposeFeedback(msg, "err");
    setStatus(msg, "err");
    return;
  }
  setApplyBtn && (setApplyBtn.disabled = true);
  setComposeFeedback("Compositie berekenen en opslaan\u2026", "busy");
  setStatus("Compositie berekenen\u2026", "busy");
  try {
    const { outer, parts, signs } = buildComposeParts(selected);
    const result = composeSigned(parts.map((p) => ({ ring: p.room.points, sign: p.sign })));
    const nameParts = sortByAreaDesc(selected).map((r) => {
      const s = signs[r.id] || "-";
      return `${s}${r.label || "?"}`;
    });
    const mpu = activeScaleMpu();
    const areaM2 = mpu != null ? Math.round(scaledAreaM2(result.areaNorm, mpu, activeScaleAspect()) * 100) / 100 : null;
    const areaBit = areaM2 != null ? ` \xB7 ${areaM2.toFixed(2)} m\xB2` : "";
    const label = `${mat.master_category}: ${mat.name}${areaBit}`;
    const vgVr = resolveComponentVgVr(selected);
    if (vgVr.error) {
      setComposeFeedback(vgVr.error, "err");
      setStatus(vgVr.error, "err");
      return;
    }
    if (vgVr.vg_nr == null || !normalizeVrNr(vgVr.vr_nr)) {
      const msg = "Samengesteld component heeft VG/VR nodig \u2014 ken die toe aan de bronnen of vul VG/VR in het formulier in";
      setComposeFeedback(msg, "err");
      setStatus(msg, "err");
      return;
    }
    const composeOri = readComponentOrientatie() || normalizeOrientatieCode(outer.analysis?.orientatie || "") || "";
    if (!composeOri || !ORIENTATIE_CODES.includes(composeOri)) {
      const msg = "Kies een gevelori\xEBntatie voor het samengestelde component (formulier bovenaan) of zet ori op de buitencontour";
      setComposeFeedback(msg, "err");
      setStatus(msg, "err");
      return;
    }
    const saved = await saveDrawingSubsection({
      section_id: activeSection.id,
      label,
      level_hint: "OTHER",
      vg_nr: vgVr.vg_nr,
      vr_nr: vgVr.vr_nr,
      points: result.outer,
      holes: result.holes,
      metres_per_norm_unit: mpu ?? void 0,
      scale_aspect_yx: activeScaleAspect(),
      analysis: {
        material_id: mat.material_id,
        master_category: mat.master_category,
        material_name: mat.name,
        catalog_id: mat.catalog_id,
        category: mat.category || void 0,
        orientatie: composeOri,
        boolean_op: "compose",
        outer_subsection_id: outer.id,
        constituent_signs: signs,
        source_subsection_ids: selected.map((r) => r.id),
        source_labels: nameParts,
        holes: result.holes,
        area_norm: result.areaNorm,
        area_m2: areaM2
      }
    });
    const savedId = saved.subsection_id;
    const savedVg = saved.vg_nr != null && Number.isFinite(Number(saved.vg_nr)) ? Number(saved.vg_nr) : vgVr.vg_nr;
    const savedVr = saved.vr_nr != null && String(saved.vr_nr).trim() ? String(saved.vr_nr).trim() : vgVr.vr_nr;
    const patched = {
      id: savedId,
      section_id: activeSection.id,
      label,
      level_hint: "OTHER",
      vg_nr: savedVg,
      vr_nr: savedVr,
      points: result.outer.map((p) => ({ ...p })),
      area_m2: saved.area_m2 != null ? Number(saved.area_m2) : areaM2,
      area_norm: saved.area_norm != null ? Number(saved.area_norm) : result.areaNorm,
      perimeter_m: saved.perimeter_m != null ? Number(saved.perimeter_m) : null,
      perimeter_norm: null,
      metres_per_norm_unit: mpu,
      analysis_status: "ok",
      sort_order: rooms.length,
      analysis: {
        material_id: mat.material_id,
        master_category: mat.master_category,
        material_name: mat.name,
        catalog_id: mat.catalog_id,
        category: mat.category || void 0,
        orientatie: composeOri,
        boolean_op: "compose",
        outer_subsection_id: outer.id,
        constituent_signs: signs,
        source_subsection_ids: selected.map((r) => r.id),
        source_labels: nameParts,
        holes: result.holes.map((h) => h.map((p) => ({ ...p }))),
        area_norm: result.areaNorm,
        area_m2: areaM2,
        ...saved.analysis || {}
      }
    };
    rooms = [...rooms.filter((r) => r.id !== savedId), patched];
    noteLocalRoomPatch(patched);
    roomsLoadEpoch += 1;
    booleanPreview = null;
    selectedSetIds.clear();
    constituentSigns.clear();
    const inheritVr = normalizeVrNr(savedVr);
    roomListVrFilter = inheritVr;
    roomVgInput.value = savedVg != null ? String(savedVg) : "";
    roomVrInput.value = inheritVr;
    renderRoomList();
    drawOverlay();
    try {
      await loadRooms({ preserveOrder: true });
    } catch (reloadErr) {
      console.warn("loadRooms after compose failed", reloadErr);
    }
    {
      const i = rooms.findIndex((r) => r.id === savedId);
      if (i < 0) {
        rooms = [...rooms, patched];
      } else {
        rooms[i] = {
          ...rooms[i],
          ...patched,
          analysis: { ...rooms[i].analysis || {}, ...patched.analysis || {} }
        };
      }
      noteLocalRoomPatch(rooms.find((r) => r.id === savedId));
    }
    roomListVrFilter = inheritVr;
    if (roomVrFilterEl) {
      if (![...roomVrFilterEl.options].some((o) => o.value === inheritVr)) {
        const opt = document.createElement("option");
        opt.value = inheritVr;
        opt.textContent = `VR ${inheritVr}`;
        roomVrFilterEl.appendChild(opt);
      }
      roomVrFilterEl.value = inheritVr;
    }
    renderRoomList();
    drawOverlay();
    updateBooleanPreview();
    markRoomTouched(savedId);
    const listEl = resolveRoomListEl();
    if (listEl) scrollActiveRoomListItemIntoView(listEl, savedId);
    const savedM2 = saved.area_m2 != null ? Number(saved.area_m2) : areaM2;
    const orangeParts = selected.filter((r) => !(r.analysis?.material_id || "").trim());
    const orangeBit = orangeParts.length ? ` Led blijft oranje tot bronnen materiaal hebben: ${orangeParts.map((r) => r.label || "?").join(", ")}.` : "";
    const okMsg = savedM2 != null ? `Opgeslagen: ${label} (netto ${savedM2.toFixed(2)} m\xB2) \xB7 VR ${inheritVr}.${orangeBit}` : `Opgeslagen: ${label} \xB7 VR ${inheritVr}.${orangeBit}`;
    setComposeFeedback(okMsg, "ok");
    setStatus(okMsg, "ok");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setComposeFeedback(msg, "err");
    setStatus(msg, "err");
  } finally {
    if (setApplyBtn) setApplyBtn.disabled = false;
  }
}
function coerceRingPoints(raw) {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const rec = item;
    const x = Number(rec.x);
    const y = Number(rec.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    out.push({ x, y });
  }
  return out;
}
function resolveRoomListEl() {
  const live = document.getElementById("fm-room-list");
  if (live) return live;
  return roomListEl && document.body.contains(roomListEl) ? roomListEl : null;
}
function resolveRoomCountEl() {
  const live = document.getElementById("fm-room-count");
  if (live) return live;
  return roomCountEl && document.body.contains(roomCountEl) ? roomCountEl : null;
}
function renderRoomList() {
  const listEl = resolveRoomListEl();
  const countEl = resolveRoomCountEl();
  if (!listEl) return;
  const listScroller = resolveRoomListScrollParent(listEl);
  const scrollTop = listScroller.scrollTop;
  const items = rooms.filter(
    (r) => Boolean(r?.id) && !isLocallyDeleted(r.id) && !isLegacySealSibling(r.analysis)
  );
  if (items.length !== rooms.length) {
    rooms = items;
  }
  const allowSetSelect = !isFloormapKind();
  listEl.replaceChildren();
  syncRoomListVrFilterOptions(items);
  const topLevelTotal = items.length;
  const visibleTopLevel = visibleTopLevelRooms(items);
  if (countEl) {
    countEl.textContent = roomListCountLabel2(visibleTopLevel.length, topLevelTotal);
    countEl.title = roomListVrFilter && visibleTopLevel.length !== topLevelTotal ? `${visibleTopLevel.length} van ${topLevelTotal} zichtbaar (filter VR ${roomListVrFilter})` : "";
  }
  if (items.length === 0) {
    const li = document.createElement("li");
    li.className = "hint drawing-list-empty";
    li.textContent = `Nog geen ${activePartNoun().plural} \u2014 Teken ${activePartNoun().singular} of Ontdek.`;
    listEl.appendChild(li);
    return;
  }
  if (visibleTopLevel.length === 0) {
    const li = document.createElement("li");
    li.className = "hint drawing-list-empty";
    li.textContent = `Geen ${activePartNoun().plural} voor VR ${roomListVrFilter}.`;
    listEl.appendChild(li);
    return;
  }
  let booleanSourceIds = /* @__PURE__ */ new Set();
  let supersededIds = /* @__PURE__ */ new Set();
  let boolGroups = /* @__PURE__ */ new Map();
  try {
    if (allowSetSelect) {
      booleanSourceIds = collectBooleanSourceIds(items);
      supersededIds = collectSupersededSourceIds(items);
      boolGroups = assignBooleanListGroups(items);
    }
  } catch (err) {
    console.warn("renderRoomList: boolean metadata failed", err);
  }
  for (const id of [...expandedComposeSourcePanels]) {
    const still = items.some((r) => r.id === id && isComposeResultRoom(r));
    if (!still) expandedComposeSourcePanels.delete(id);
  }
  items.forEach((r, index) => {
    if (!roomMatchesVrFilter(r, roomListVrFilter)) return;
    try {
      renderRoomListItem(listEl, r, index, items.length, {
        allowSetSelect,
        booleanSourceIds,
        supersededIds,
        boolGroups,
        allItems: items
      });
    } catch (err) {
      console.warn("renderRoomList: item failed", r.id, err);
      const fallback = document.createElement("li");
      fallback.className = "drawing-list-item";
      fallback.textContent = r.label || r.id;
      listEl.appendChild(fallback);
    }
  });
  if (pendingRoom?.editingId && !roomListRefreshQuiet) {
    scrollActiveRoomListItemIntoView(listEl, pendingRoom.editingId);
  } else {
    listScroller.scrollTop = scrollTop;
  }
}
function resolveRoomListScrollParent(listEl) {
  return listEl.closest(".engineer-sidebar") || listEl;
}
function scrollActiveRoomListItemIntoView(listEl, roomId) {
  const run = () => {
    const li = listEl.querySelector(
      `.drawing-list-item[data-room-id="${CSS.escape(roomId)}"]`
    ) || listEl.querySelector(".drawing-list-item.selected");
    if (!li) return;
    const scroller = resolveRoomListScrollParent(listEl);
    const scrollerRect = scroller.getBoundingClientRect();
    const liRect = li.getBoundingClientRect();
    const viewTop = scroller.scrollTop;
    const liTop = viewTop + (liRect.top - scrollerRect.top);
    const liBottom = liTop + liRect.height;
    const viewBottom = viewTop + scroller.clientHeight;
    const pad = 8;
    if (liTop < viewTop + pad) {
      scroller.scrollTop = Math.max(0, liTop - pad);
    } else if (liBottom > viewBottom - pad) {
      scroller.scrollTop = Math.max(0, liBottom - scroller.clientHeight + pad);
    }
  };
  requestAnimationFrame(() => requestAnimationFrame(run));
}
function renderRoomListItem(listEl, r, index, total, meta) {
  const { allowSetSelect, booleanSourceIds, supersededIds, boolGroups, allItems } = meta;
  const li = document.createElement("li");
  li.className = "drawing-list-item";
  li.dataset.roomId = r.id;
  if (allowSetSelect) li.classList.add("drawing-list-item--set");
  if (pendingRoom?.editingId === r.id) li.classList.add("selected");
  if (touchedRoomIds.has(normRoomId(r.id))) li.classList.add("drawing-list-item--touched");
  if (allowSetSelect && selectedSetIds.has(r.id)) li.classList.add("set-selected");
  if (allowSetSelect && booleanSourceIds.has(r.id)) li.classList.add("drawing-list-item--ga-source");
  const boolRole = boolGroups.get(r.id);
  if (boolRole) applyBooleanListColors(li, boolRole);
  const boolOp = parseBooleanOp(r.analysis?.boolean_op);
  if (boolOp === "compose" || boolOp === "difference") {
    li.classList.add("drawing-list-item--composed");
  }
  if (allowSetSelect && booleanSourceIds.has(r.id) && !isComposeResultRoom(r)) {
    li.classList.add("drawing-list-item--compose-source");
  }
  if (allowSetSelect) {
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "set-select-cb";
    cb.checked = selectedSetIds.has(r.id);
    cb.title = "Selecteer voor +/\u2212 compositie";
    cb.addEventListener("change", () => {
      if (cb.checked) selectedSetIds.add(r.id);
      else {
        selectedSetIds.delete(r.id);
        constituentSigns.delete(r.id);
      }
      updateBooleanPreview();
      void defaultMaterialFromDifferenceSubject();
      renderRoomList();
      syncPendingRoomButtons();
      if (pendingRoom?.editingId === r.id) syncKierSuggestUi();
    });
    li.appendChild(cb);
  }
  const info = document.createElement("button");
  info.type = "button";
  info.className = "drawing-list-select";
  const linked = linkedRooms.get(r.id);
  const hasMaterial = Boolean((r.analysis?.material_id || "").trim());
  const missingSources = isComposeResultRoom(r) ? composeConstituentsMissingMaterial(r, allItems) : [];
  const hasVg = r.vg_nr != null && Number.isFinite(Number(r.vg_nr)) && Number(r.vg_nr) > 0;
  const hasVr = Boolean(normalizeVrNr(r.vr_nr));
  const hasVgVr = hasVg && hasVr;
  const oriCodes = Array.isArray(r.analysis?.expected_orientaties) ? r.analysis.expected_orientaties.map((c) => normalizeOrientatieCode(c)).filter((c) => ORIENTATIE_CODES.includes(c)) : [];
  const compOri = normalizeOrientatieCode(r.analysis?.orientatie || "");
  const compOriOk = ORIENTATIE_CODES.includes(compOri);
  const ledGreen = hasMaterial && missingSources.length === 0 && (!allowSetSelect || compOriOk);
  const oriBit = isFloormapKind() ? oriCodes.length ? `ori ${oriCodes.join(",")}` : "ori ontbreekt" : "";
  const isComposed = boolOp === "compose" || boolOp === "difference";
  const matBit = materialAnalysisLabel(r.analysis, { skipOp: isComposed });
  let gaBit = "";
  if (allowSetSelect) {
    if (supersededIds.has(r.id)) {
      gaBit = " \xB7 bron van \xB1 (zelfde materiaal \u2192 netto)";
    } else if (booleanSourceIds.has(r.id)) {
      gaBit = " \xB7 bron van \xB1";
    } else if (missingSources.length) {
      gaBit = ` \xB7 bronnen zonder materiaal: ${missingSources.map((s) => s.label || "?").join(", ")}`;
    } else if (hasVr && hasMaterial && !compOriOk) {
      gaBit = " \xB7 berekening: nog ori\xEBntatie kiezen";
    } else if (hasVr && hasMaterial) {
      gaBit = " \xB7 in berekening";
    } else if (hasVr) {
      gaBit = " \xB7 berekening: nog materiaal toevoegen";
    }
  }
  const linkBit = activeSection?.region_kind === "FLOORMAP" && linked ? ` \xB7 berekening: ${linked}` : activeSection?.region_kind === "FLOORMAP" ? " \xB7 niet in berekening" : "";
  const parts = [
    roomListDisplayLabel(r),
    repeatCountBit(r.analysis),
    matBit,
    // Oriëntatie staat apart als badge (floormap); niet ook in de tekstregel.
    isFloormapKind() ? "" : oriBit,
    levelLabel(r.level_hint),
    roomMetricsLabel(r)
  ].filter(Boolean);
  const inner = document.createElement("span");
  inner.className = "drawing-list-select-inner";
  const metaRow = document.createElement("span");
  metaRow.className = "drawing-list-meta";
  if (isComposed) {
    const composedBadge = document.createElement("span");
    composedBadge.className = "drawing-list-composed-badge";
    composedBadge.textContent = "\xB1 samengesteld";
    composedBadge.title = "Netto-resultaat van +/\u2212 compositie";
    metaRow.appendChild(composedBadge);
  }
  const vgVrBadge = document.createElement("span");
  vgVrBadge.className = hasVgVr ? "drawing-list-vgvr" : "drawing-list-vgvr drawing-list-vgvr--missing";
  if (hasVgVr) {
    vgVrBadge.textContent = `VG ${Number(r.vg_nr)} \xB7 VR ${normalizeVrNr(r.vr_nr)}`;
  } else if (hasVg || hasVr) {
    vgVrBadge.textContent = [
      hasVg ? `VG ${Number(r.vg_nr)}` : "VG \u2014",
      hasVr ? `VR ${normalizeVrNr(r.vr_nr)}` : "VR \u2014"
    ].join(" \xB7 ");
    vgVrBadge.classList.add("drawing-list-vgvr--partial");
  } else {
    vgVrBadge.textContent = "geen VG/VR";
  }
  metaRow.appendChild(vgVrBadge);
  if (isFloormapKind()) {
    const oriBadge = document.createElement("span");
    oriBadge.className = oriCodes.length ? "drawing-list-ori" : "drawing-list-ori drawing-list-ori--missing";
    oriBadge.textContent = oriCodes.length ? `ori ${oriCodes.join(",")}` : "ori ontbreekt";
    oriBadge.title = "Klik de regel om gevelori\xEBntaties te bewerken (bovenaan in de zijbalk)";
    metaRow.appendChild(oriBadge);
  } else if (allowSetSelect) {
    const oriBadge = document.createElement("span");
    oriBadge.className = compOriOk ? "drawing-list-ori" : "drawing-list-ori drawing-list-ori--missing";
    oriBadge.textContent = compOriOk ? `ori ${compOri}` : "ori ontbreekt";
    oriBadge.title = compOriOk ? "Gevelori\xEBntatie van dit component" : "Kies gevelori\xEBntatie bovenaan in de zijbalk";
    metaRow.appendChild(oriBadge);
  }
  if (allowSetSelect) {
    const led = document.createElement("span");
    led.className = "ga-ready-led";
    led.setAttribute("role", "status");
    if (ledGreen) {
      led.classList.add("is-on");
      led.title = "Materiaal + ori\xEBntatie \u2014 kiesbaar in GA";
      led.setAttribute("aria-label", "Compleet voor GA");
    } else {
      led.classList.add("is-warn");
      led.title = missingSources.length ? `Samengesteld component blijft oranje tot bronnen materiaal hebben: ${missingSources.map((s) => s.label || "?").join(", ")}` : !hasMaterial ? "Nog geen materiaal \u2014 koppel later voor vlakdelen" : allowSetSelect && !compOriOk ? "Nog geen gevelori\xEBntatie \u2014 kies N\u2026NW bovenaan; zonder ori niet kiesbaar in GA" : "Nog onvolledig voor GA";
      led.setAttribute(
        "aria-label",
        missingSources.length ? "Nog oranje bronnen zonder materiaal" : !hasMaterial ? "Nog geen materiaal" : allowSetSelect && !compOriOk ? "Nog geen ori\xEBntatie" : "Nog onvolledig"
      );
    }
    metaRow.appendChild(led);
  }
  inner.appendChild(metaRow);
  const labelSpan = document.createElement("span");
  labelSpan.className = "drawing-list-select-label";
  labelSpan.textContent = `${parts.join(" \xB7 ")}${gaBit}${linkBit}`;
  inner.appendChild(labelSpan);
  info.appendChild(inner);
  info.title = missingSources.length ? `Samengesteld component: eerst materiaal op bronnen (${missingSources.map((s) => s.label || "?").join(", ")})` : boolOp === "compose" || boolOp === "difference" ? "Samengesteld component (+/\u2212) \u2014 netto uit geselecteerde delen; Bronnen verwijst naar de originelen in de lijst" : booleanSourceIds.has(r.id) ? (() => {
    const parents = composeParentsOfSource(r.id, allItems);
    const names = parents.map((p) => p.label || "\xB1").join(", ");
    return names ? `Bron van samengesteld component: ${names} (blijft in de lijst, kiesbaar voor vlaktoekenning)` : "Bron van een setbewerking \u2014 blijft in de lijst en kiesbaar voor vlaktoekenning";
  })() : allowSetSelect && !hasMaterial ? "Nog geen materiaal (oranje) \u2014 klik om te bewerken of materiaal te koppelen" : "Klik om geometrie te bewerken";
  info.addEventListener("click", () => editRoom(r));
  li.appendChild(info);
  const actions = document.createElement("span");
  actions.className = "drawing-list-actions";
  const upBtn = document.createElement("button");
  upBtn.type = "button";
  upBtn.className = "secondary drawing-list-move drawing-list-move-icon";
  upBtn.textContent = "\u25B2";
  upBtn.setAttribute("aria-label", "Verplaats omhoog in de lijst");
  upBtn.title = "Omhoog";
  upBtn.disabled = index === 0;
  upBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    void moveRoom(r.id, -1);
  });
  actions.appendChild(upBtn);
  const downBtn = document.createElement("button");
  downBtn.type = "button";
  downBtn.className = "secondary drawing-list-move drawing-list-move-icon";
  downBtn.textContent = "\u25BC";
  downBtn.setAttribute("aria-label", "Verplaats omlaag in de lijst");
  downBtn.title = "Omlaag";
  downBtn.disabled = index >= total - 1;
  downBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    void moveRoom(r.id, 1);
  });
  actions.appendChild(downBtn);
  if (allowSetSelect && !isLegacySealSibling(r.analysis)) {
    const n = readRepeatCount(r.analysis);
    const wrap = document.createElement("span");
    wrap.className = "drawing-list-repeat";
    wrap.title = "Hoe vaak dit component meetelt in de GA-berekening (oppervlak/lengte/kier). Lijst blijft \xE9\xE9n regel.";
    const dec = document.createElement("button");
    dec.type = "button";
    dec.className = "secondary drawing-list-repeat-btn";
    dec.textContent = "\u2212";
    dec.setAttribute("aria-label", "Minder herhalingen");
    dec.disabled = n <= 1;
    dec.addEventListener("click", (ev) => {
      ev.stopPropagation();
      void saveRepeatCountForRoom(r, n - 1);
    });
    const mid = document.createElement("span");
    mid.className = "drawing-list-repeat-val";
    mid.textContent = `${n}\xD7`;
    mid.setAttribute("aria-label", `Herhaling ${n} keer`);
    const inc = document.createElement("button");
    inc.type = "button";
    inc.className = "secondary drawing-list-repeat-btn";
    inc.textContent = "+";
    inc.setAttribute("aria-label", "Meer herhalingen");
    inc.disabled = n >= REPEAT_COUNT_MAX;
    inc.addEventListener("click", (ev) => {
      ev.stopPropagation();
      void saveRepeatCountForRoom(r, n + 1);
    });
    wrap.appendChild(dec);
    wrap.appendChild(mid);
    wrap.appendChild(inc);
    actions.appendChild(wrap);
  }
  if (activeSection?.region_kind === "FLOORMAP" && buildingId) {
    const ga = document.createElement("a");
    ga.className = "secondary-link";
    const q = new URLSearchParams({ building_id: buildingId, subsection_id: r.id });
    if (r.vg_nr != null) q.set("vg_nr", String(r.vg_nr));
    if (r.vr_nr != null && String(r.vr_nr).trim()) q.set("vr_nr", String(r.vr_nr).trim());
    ga.href = `/ga.html?${q.toString()}`;
    ga.textContent = linked ? "Definieer gevelvlakken" : "Koppel aan berekening gevelwering";
    ga.title = linked ? "Definieer gevelvlakken voor dit VG/VR in de berekening" : "Neem VG/VR over in de berekening gevelwering";
    actions.appendChild(ga);
  }
  const isClosedArea = !(r.analysis?.quantity_kind === "length" && r.analysis?.open_path) && Array.isArray(r.points) && r.points.length >= 3;
  const canDuplicate = isClosedArea || componentIsLengthQuantity(r) && Array.isArray(r.points) && r.points.length >= 2;
  if (canDuplicate) {
    const dup = document.createElement("button");
    dup.type = "button";
    dup.className = "secondary";
    dup.textContent = "Kopie";
    dup.title = "Dupliceer rond dit component (Shift+klik: vraag aantal)";
    dup.addEventListener("click", (ev) => {
      ev.stopPropagation();
      void duplicateFromRoom(r, ev.shiftKey ? void 0 : 1);
    });
    actions.appendChild(dup);
  }
  const hasSeal = componentHasSeal(r);
  const setSelected = selectedSetIds.has(r.id);
  const editingThisRow = pendingRoom?.editingId === r.id;
  const canOfferKier = allowSetSelect && !componentIsLengthQuantity(r) && !isLegacySealSibling(r.analysis) && isClosedArea && !isOpenComponent(r) && (hasSeal || ledGreen && (setSelected || editingThisRow));
  if (canOfferKier) {
    const wrap = document.createElement("label");
    wrap.className = "drawing-list-kier";
    const canCheck = setSelected || editingThisRow || hasSeal;
    const code = sealCatalogLabel(r.analysis, DEFAULT_KIER_CATALOG_ID);
    wrap.title = hasSeal ? `Kierdichting aan (${code}). Uitvinken zet het kenmerk uit.` : setSelected || editingThisRow ? `Kierdichting (omtrek) \u2014 standaard ${DEFAULT_KIER_CATALOG_ID}. Meestal op een samengesteld \xB1-component.` : "Open of selecteer het component om kierdichting aan te zetten";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "drawing-list-kier-cb";
    cb.checked = hasSeal;
    cb.disabled = !canCheck;
    cb.addEventListener("click", (ev) => ev.stopPropagation());
    cb.addEventListener("change", (ev) => {
      ev.stopPropagation();
      if (cb.checked && !selectedSetIds.has(r.id) && pendingRoom?.editingId !== r.id) {
        cb.checked = componentHasSeal(r);
        setStatus("Open of selecteer het component om kierdichting toe te voegen", "err");
        return;
      }
      if (pendingRoom?.editingId === r.id && kierSuggestCb) {
        kierSuggestCb.checked = cb.checked;
        kierSuggestCb.dataset.userTouched = "1";
      }
      void toggleKierSealForRoom(r, cb.checked).then(() => {
        if (pendingRoom?.editingId === r.id) syncKierSuggestUi();
      });
    });
    wrap.appendChild(cb);
    const txt = document.createElement("span");
    txt.textContent = `Kier ${code}`;
    wrap.appendChild(txt);
    actions.appendChild(wrap);
    void ensureKierMaterials();
  }
  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.textContent = "Opslaan";
  const editingThis = pendingRoom?.editingId === r.id;
  const kier = !isFloormapKind() && pendingSaveIsLength();
  const canSaveThis = Boolean(
    editingThis && pendingRoom && (pendingRoom.closed && pendingRoom.points.length >= 3 || kier && !pendingRoom.closed && pendingRoom.points.length >= 2)
  );
  saveBtn.disabled = !canSaveThis;
  saveBtn.className = canSaveThis ? "" : "secondary";
  saveBtn.title = editingThis ? canSaveThis ? "Sla de huidige bewerking op" : "Nog niet opslaanbaar \u2014 sluit de polygoon of teken verder" : "Open dit component (klik de regel) om te bewerken, daarna Opslaan";
  saveBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    ev.preventDefault();
    if (!pendingRoom || pendingRoom.editingId !== r.id) {
      setStatus("Open dit component eerst (klik de regel) om te bewerken", "err");
      return;
    }
    void savePendingRoom();
  });
  actions.appendChild(saveBtn);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "secondary";
  btn.textContent = pendingDeleteId === r.id ? "Bevestig wissen" : "Verwijderen";
  if (pendingDeleteId === r.id) {
    btn.classList.remove("secondary");
    btn.title = "Nogmaals klikken wist dit component permanent";
  } else {
    btn.title = isComposeResultRoom(r) ? "Verwijdert alleen dit samengestelde resultaat; broncomponenten blijven bestaan" : "Permanent verwijderen";
  }
  btn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    void deleteRoom(r.id);
  });
  actions.appendChild(btn);
  const sourceRefs = allowSetSelect && isComposed ? collectComposeSourceRefs(r, allItems) : [];
  if (sourceRefs.length) {
    const expanded = expandedComposeSourcePanels.has(r.id);
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "secondary drawing-list-compose-toggle";
    toggle.textContent = expanded ? `\u25BE Bronnen (${sourceRefs.length})` : `\u25B8 Bronnen (${sourceRefs.length})`;
    toggle.title = "Toon welke originelen in de lijst bij dit samengestelde component horen (klik een naam om ernaar te springen)";
    toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    toggle.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (expandedComposeSourcePanels.has(r.id)) expandedComposeSourcePanels.delete(r.id);
      else expandedComposeSourcePanels.add(r.id);
      renderRoomList();
    });
    actions.insertBefore(toggle, actions.firstChild);
  }
  li.appendChild(actions);
  if (sourceRefs.length && expandedComposeSourcePanels.has(r.id)) {
    const refs = document.createElement("div");
    refs.className = "drawing-list-compose-refs";
    refs.setAttribute("role", "group");
    refs.setAttribute(
      "aria-label",
      `Bronnen van ${r.label || "samengesteld component"} (verwijzingen naar de lijst)`
    );
    const intro = document.createElement("p");
    intro.className = "drawing-list-compose-refs-hint";
    intro.textContent = "Originelen blijven in de lijst (groene markering). Klik een bron om ernaar te springen:";
    refs.appendChild(intro);
    for (const ref of sourceRefs) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "drawing-list-compose-ref";
      if (ref.missing) row.classList.add("is-missing");
      row.title = ref.missing ? "Bron ontbreekt in deze sectie" : `Ga naar \xAB${ref.label}\xBB in de lijst`;
      const signEl = document.createElement("span");
      signEl.className = "drawing-list-compose-ref-sign";
      signEl.textContent = ref.sign;
      const nameEl = document.createElement("span");
      nameEl.className = "drawing-list-compose-ref-label";
      nameEl.textContent = ref.missing ? `${ref.label} (ontbreekt)` : ref.label;
      row.appendChild(signEl);
      row.appendChild(nameEl);
      row.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (ref.missing) {
          setStatus(`Bron \xAB${ref.label}\xBB ontbreekt in deze sectie`, "err");
          return;
        }
        focusComposeSourceInList(ref.id);
      });
      refs.appendChild(row);
    }
    li.appendChild(refs);
  }
  listEl.appendChild(li);
}
async function refreshLinkedRooms() {
  linkedRooms = /* @__PURE__ */ new Map();
  if (!auth()?.token || !buildingId) return;
  try {
    const ret = await invokeString("API_ListLinkedSubsections", [auth().token, buildingId]);
    if (ret.startsWith("ERROR")) return;
    const data = JSON.parse(ret);
    for (const l of data.links || []) {
      linkedRooms.set(l.subsection_id, l.omschrijving);
    }
  } catch {
  }
}
function normalizeSection(s) {
  const viewRot = Number(s.view_rotate);
  return {
    ...s,
    id: String(s.id),
    document_id: String(s.document_id || ""),
    label: String(s.label || ""),
    region_kind: String(s.region_kind || "FLOORMAP").toUpperCase() || "FLOORMAP",
    page_index: Number(s.page_index) || 0,
    x_min: Number(s.x_min),
    y_min: Number(s.y_min),
    x_max: Number(s.x_max),
    y_max: Number(s.y_max),
    scale_ratio: s.scale_ratio != null ? Number(s.scale_ratio) : null,
    metres_per_norm_unit: s.metres_per_norm_unit != null ? Number(s.metres_per_norm_unit) : null,
    scale_aspect_yx: s.scale_aspect_yx != null && Number(s.scale_aspect_yx) > 0 ? Number(s.scale_aspect_yx) : null,
    scale_source: String(s.scale_source || "NONE"),
    view_rotate: viewRot === 90 || viewRot === 180 || viewRot === 270 ? viewRot : 0,
    room_count: Number(s.room_count) || 0
  };
}
async function ensureSectionInList(sectionId) {
  if (sections.some((s) => s.id === sectionId)) return true;
  try {
    const data = bppPhase1Enabled() ? await bppGetFloormapSection(invokeString, auth().token, sectionId) : await apiGet(
      `/api/floormap/section?section_id=${encodeURIComponent(sectionId)}`
    );
    if (!data.section?.id) return false;
    sections = [normalizeSection(data.section), ...sections.filter((s) => s.id !== data.section.id)];
    renderSectionList();
    return true;
  } catch {
    return false;
  }
}
async function saveDrawingSubsection(body) {
  if (!auth()?.token) throw new Error("Niet ingelogd");
  if (bppPhase1Enabled()) {
    const saved = await bppSaveDrawingSubsection(invokeString, auth().token, body);
    return {
      subsection_id: saved.subsection_id,
      area_m2: saved.area_m2,
      perimeter_m: saved.perimeter_m,
      analysis: saved.analysis,
      area_norm: saved.area_norm,
      vg_nr: saved.vg_nr != null ? Number(saved.vg_nr) : null,
      vr_nr: saved.vr_nr != null && String(saved.vr_nr).trim() ? String(saved.vr_nr).trim() : null
    };
  }
  return apiPost("/api/floormap/subsections", body);
}
async function deleteDrawingSubsection(subsectionId) {
  if (!auth()?.token) throw new Error("Niet ingelogd");
  if (bppPhase1Enabled()) {
    await bppDeleteDrawingSubsection(invokeString, auth().token, subsectionId);
    return;
  }
  await apiDelete(`/api/floormap/subsections?subsection_id=${encodeURIComponent(subsectionId)}`);
}
async function reorderDrawingSubsections(sectionId, orderedIds) {
  if (!auth()?.token) throw new Error("Niet ingelogd");
  if (bppPhase1Enabled()) {
    await bppReorderDrawingSubsections(invokeString, auth().token, sectionId, orderedIds);
    return;
  }
  await apiPost("/api/floormap/subsections/reorder", {
    section_id: sectionId,
    ordered_ids: orderedIds
  });
}
async function allSubsectionIdsForSection(sectionId) {
  if (!auth()?.token) return [];
  const raw = bppPhase1Enabled() ? (await bppListDrawingSubsections(invokeString, auth().token, sectionId)).subsections : (await apiGet(
    `/api/floormap/subsections?section_id=${encodeURIComponent(sectionId)}`
  )).subsections;
  return mapSubsectionRows(raw).sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label)).map((r) => r.id).filter(Boolean);
}
function mergeReorderIds(visibleOrder, allIds) {
  const vis = visibleOrder.filter(Boolean);
  const visSet = new Set(vis);
  const tail = allIds.filter((id) => !visSet.has(id));
  return [...vis, ...tail];
}
function mapSubsectionRows(raw) {
  return (raw || []).map((r) => ({
    ...r,
    points: coerceRingPoints(r.points),
    vg_nr: r.vg_nr != null ? Number(r.vg_nr) : null,
    vr_nr: r.vr_nr != null && String(r.vr_nr).trim() ? String(r.vr_nr).trim() : null,
    area_norm: r.area_norm != null ? Number(r.area_norm) : null,
    perimeter_norm: r.perimeter_norm != null ? Number(r.perimeter_norm) : null,
    area_m2: r.area_m2 != null ? Math.round(Number(r.area_m2) * 100) / 100 : null,
    perimeter_m: r.perimeter_m != null ? Math.round(Number(r.perimeter_m) * 100) / 100 : null,
    metres_per_norm_unit: r.metres_per_norm_unit != null && Number(r.metres_per_norm_unit) > 0 ? Number(r.metres_per_norm_unit) : null,
    sort_order: Number.isFinite(Number(r.sort_order)) ? Number(r.sort_order) : 0,
    analysis: (() => {
      if (!(r.analysis && typeof r.analysis === "object")) return null;
      const a = r.analysis;
      const holes = Array.isArray(a.holes) ? a.holes.map((h) => coerceRingPoints(h)).filter((h) => h.length >= 3) : void 0;
      return { ...a, holes };
    })()
  }));
}
function formatScaleRecomputeMsg(stats, mmLabel) {
  const n = Number(stats?.subsections) || 0;
  const ga = Number(stats?.ga_cleared) || 0;
  const bits = [`${n} component${n === 1 ? "" : "en"} herberekend`];
  if (ga > 0) bits.push(`GA gewist voor ${ga} VR${ga === 1 ? "" : "\u2019s"}`);
  else bits.push("GA opnieuw berekenen indien van toepassing");
  const head = mmLabel ? `Schaal opgeslagen (${mmLabel}). ` : "Schaal opgeslagen. ";
  return `${head}${bits.join(" \xB7 ")}.`;
}
async function persistSectionScale(opts) {
  if (!auth()?.token) throw new Error("Niet ingelogd");
  if (bppPhase1Enabled()) {
    return bppSaveFloormapScale(invokeString, auth().token, opts);
  }
  return apiPost("/api/floormap/scale", {
    section_id: opts.section_id,
    metres_per_norm_unit: opts.metres_per_norm_unit,
    scale_ratio: opts.scale_ratio ?? null,
    scale_source: opts.scale_source,
    scale_aspect_yx: opts.scale_aspect_yx ?? null
  });
}
async function fetchFloormapSections(buildingId2) {
  if (bppPhase1Enabled()) {
    const data2 = await bppListFloormapSections(invokeString, auth().token, buildingId2);
    return (data2.sections || []).map((s) => normalizeSection(s));
  }
  const data = await apiGet(
    `/api/floormap/sections?building_id=${encodeURIComponent(buildingId2)}`
  );
  return (data.sections || []).map((s) => normalizeSection(s));
}
async function loadFloormapSections(bid) {
  if (!auth()?.token) return;
  buildingId = bid.trim();
  refreshLastComponentOrientatieFromStorage();
  clearSectionThumbnailCachesForBuilding(buildingId);
  if (!buildingId) {
    setStatus("Voer een project-id in", "err");
    return;
  }
  buildingInput.value = buildingId;
  if (gaLinkEl) {
    gaLinkEl.href = `/ga.html?building_id=${encodeURIComponent(buildingId)}`;
  }
  setStatus("Secties laden\u2026", "busy");
  try {
    await refreshBuildingMeta();
    await refreshLinkedRooms();
    const data = await fetchFloormapSections(buildingId);
    sections = data;
    const sectionToOpen = resolveSectionToOpen(buildingId);
    if (sectionToOpen) {
      await ensureSectionInList(sectionToOpen);
    }
    syncWorkspaceLabels(sections[0]?.region_kind || "FLOORMAP");
    renderSectionList();
    sectionRoomsSnapshot.clear();
    resetSectionWorkspace();
    activeSection = null;
    updateScaleUi();
    pickerPanelEl.classList.remove("hidden");
    workspacePanelEl.classList.add("hidden");
    syncFloormapLocation(sectionToOpen || null);
    projectMenu?.rememberCurrent();
    projectMenu?.refreshTitle();
    void loadFavoriteMaterials();
    setStatus(`${sections.length} sectie(s)`, "ok");
    if (sectionToOpen && sections.some((s) => s.id === sectionToOpen)) {
      await openSection(sectionToOpen);
    } else if (sectionToOpen) {
      setStatus("Sectie niet gevonden of niet schaalbaar \u2014 controleer de engineer-beoordelingslink", "err");
    }
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  }
}
function applyPreferredRoomOrder(incoming, preferredIds) {
  if (!preferredIds.length) {
    return [...incoming].sort(
      (a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, "nl")
    );
  }
  const byId = new Map(incoming.map((r) => [r.id, r]));
  const out = [];
  for (const id of preferredIds) {
    const r = byId.get(id);
    if (!r) continue;
    out.push(r);
    byId.delete(id);
  }
  const rest = [...byId.values()].sort(
    (a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, "nl")
  );
  out.push(...rest);
  out.forEach((r, i) => {
    r.sort_order = i;
  });
  return out;
}
async function loadRooms(opts) {
  if (!auth()?.token || !activeSection) return;
  const preferredIds = opts?.preserveOrder ? rooms.map((r) => r.id) : [];
  const prevRooms = rooms.map((r) => ({
    ...r,
    points: r.points.map((p) => ({ ...p }))
  }));
  const epoch = ++roomsLoadEpoch;
  const sectionId = activeSection.id;
  try {
    const raw = bppPhase1Enabled() ? (await bppListDrawingSubsections(invokeString, auth().token, sectionId)).subsections : (await apiGet(
      `/api/floormap/subsections?section_id=${encodeURIComponent(sectionId)}`
    )).subsections;
    if (epoch !== roomsLoadEpoch || activeSection?.id !== sectionId) return;
    let mapped = mapSubsectionRows(raw);
    mapped = dropLocallyDeletedRooms(mergeRoomsWithLocalPatches(mapped));
    const mappedIds = new Set(mapped.map((r) => normRoomId(r.id)));
    for (const r of prevRooms) {
      const id = normRoomId(r.id);
      if (mappedIds.has(id) || isLocallyDeleted(r.id)) continue;
      if (r.section_id && r.section_id !== sectionId) continue;
      const hasPatch = localRoomPatches.has(r.id) || localRoomPatches.has(id) || touchedRoomIds.has(id) || localLabelOverrides.has(id);
      if (!hasPatch) continue;
      mapped.push(r);
      mappedIds.add(id);
    }
    if (prevRooms.length) {
      const prevById = new Map(prevRooms.map((r) => [normRoomId(r.id), r]));
      mapped = mapped.map((r) => {
        const prev = prevById.get(normRoomId(r.id));
        if (!prev) return r;
        const prevLabel = (prev.label || "").trim();
        const curLabel = (r.label || "").trim();
        if (!prevLabel || prevLabel === curLabel) return r;
        if (!touchedRoomIds.has(normRoomId(r.id)) && !localLabelOverrides.has(normRoomId(r.id)) && !localRoomPatches.has(normRoomId(r.id))) {
          return r;
        }
        noteLocalLabel(r.id, prevLabel);
        return { ...r, label: prevLabel };
      });
    }
    mapped = applyLocalLabelOverrides(mapped);
    if (preferredIds.length) {
      mapped = applyPreferredRoomOrder(mapped, preferredIds);
    } else {
      mapped.sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));
    }
    rooms = mapped;
    sectionRoomsSnapshot.delete(sectionId);
    selectedSetIds = new Set([...selectedSetIds].filter((id) => rooms.some((r) => r.id === id)));
    for (const id of [...constituentSigns.keys()]) {
      if (!selectedSetIds.has(id)) constituentSigns.delete(id);
    }
    renderRoomList();
    drawOverlay();
  } catch (err) {
    if (epoch === roomsLoadEpoch) {
      renderRoomList();
      drawOverlay();
    }
    throw err;
  }
  if (epoch !== roomsLoadEpoch || activeSection?.id !== sectionId) return;
  try {
    updateBooleanPreview();
  } catch {
    booleanPreview = null;
  }
  try {
    await restoreScaleFromRooms();
  } catch {
  }
  if (epoch !== roomsLoadEpoch || activeSection?.id !== sectionId) return;
  try {
    await refreshLinkedRooms();
    if (epoch !== roomsLoadEpoch || activeSection?.id !== sectionId) return;
    renderRoomList();
    drawOverlay();
  } catch {
  }
  if (epoch === roomsLoadEpoch) {
    syncCopyLayoutUi();
    invalidateGevelCopySources();
    syncCopyGevelUi();
    requestAnimationFrame(() => {
      if (epoch === roomsLoadEpoch) drawOverlay();
    });
  }
}
async function restoreScaleFromRooms() {
  if (!activeSection || !auth()?.token) return;
  if (activeSection.metres_per_norm_unit != null && activeSection.metres_per_norm_unit > 0) {
    updateScaleUi();
    return;
  }
  const withScale = rooms.find(
    (r) => r.metres_per_norm_unit != null && r.metres_per_norm_unit > 0
  );
  if (!withScale?.metres_per_norm_unit) {
    updateScaleUi();
    return;
  }
  const mpu = withScale.metres_per_norm_unit;
  activeSection.metres_per_norm_unit = mpu;
  if (!activeSection.scale_source || activeSection.scale_source === "NONE") {
    activeSection.scale_source = "CALIBRATED";
  }
  updateScaleUi();
  updateMeasureReadouts();
  try {
    await persistSectionScale({
      section_id: activeSection.id,
      metres_per_norm_unit: mpu,
      scale_ratio: activeSection.scale_ratio,
      scale_source: activeSection.scale_source || "CALIBRATED",
      scale_aspect_yx: activeScaleAspect()
    });
  } catch {
  }
}
async function ensureScaleAspectSynced() {
  if (!activeSection || !auth()?.token) return;
  const mpu = activeSection.metres_per_norm_unit;
  if (mpu == null || !(mpu > 0) || canvasWidth < 1 || canvasHeight < 1) return;
  const aspect = canvasHeight / canvasWidth;
  const prev = activeSection.scale_aspect_yx;
  if (prev != null && Math.abs(prev - aspect) < 1e-6) return;
  try {
    await persistSectionScale({
      section_id: activeSection.id,
      metres_per_norm_unit: mpu,
      scale_ratio: activeSection.scale_ratio,
      scale_source: activeSection.scale_source || "CALIBRATED",
      scale_aspect_yx: aspect
    });
    activeSection.scale_aspect_yx = aspect;
    const idx = sections.findIndex((s) => s.id === activeSection.id);
    if (idx >= 0) sections[idx] = activeSection;
    await loadRooms();
  } catch {
    activeSection.scale_aspect_yx = aspect;
  }
}
function resetSectionWorkspace(opts) {
  endDiscovery();
  endCalibrate();
  void endDetail();
  if (measure.tool !== "off") clearMeasure(false);
  clearPendingDeleteConfirm();
  pendingRoom = null;
  if (kierSuggestCb) {
    kierSuggestCb.checked = false;
    delete kierSuggestCb.dataset.userTouched;
  }
  rooms = [];
  selectedSetIds.clear();
  constituentSigns.clear();
  booleanPreview = null;
  linkedRooms.clear();
  if (!opts?.preserveLocalRoomState) {
    localRoomPatches.clear();
    localRoomDeletions.clear();
  }
  roomsLoadEpoch += 1;
  cropBitmap = null;
  canvasWidth = 0;
  canvasHeight = 0;
  for (const c of [pdfCanvas, overlayCanvas]) {
    c.width = 1;
    c.height = 1;
    c.style.width = "1px";
    c.style.height = "1px";
    const ctx = c.getContext("2d");
    ctx?.clearRect(0, 0, 1, 1);
  }
  syncPendingRoomButtons();
  syncEditDock();
  syncToolButtons();
  updateMeasureReadouts();
  updateToolHint();
  renderRoomList();
}
async function openSection(sectionId) {
  const sec = sections.find((s) => s.id === sectionId);
  if (!sec || !auth()?.token) return;
  resetSectionWorkspace();
  activeSection = sec;
  persistLastSectionId(buildingId, sec.id);
  syncFloormapLocation(sec.id);
  const n = partNoun(sec.region_kind);
  syncWorkspaceLabels(sec.region_kind);
  sectionTitleEl.textContent = sec.label || n.title;
  sectionMetaEl.textContent = `${n.kindLabel} \xB7 pagina ${sec.page_index + 1} \xB7 ${sec.document_id.slice(0, 8)}\u2026`;
  pickerPanelEl.classList.add("hidden");
  workspacePanelEl.classList.remove("hidden");
  updateScaleUi();
  setStatus(`${n.title} laden\u2026`, "busy");
  let pdfErr = null;
  let roomsErr = null;
  try {
    await loadCroppedPdf(sec);
    await tryDetectPdfScale(sec);
    await ensureScaleAspectSynced();
    updateScaleUi();
  } catch (err) {
    pdfErr = err;
  }
  try {
    await loadRooms();
  } catch (err) {
    roomsErr = err;
  }
  try {
    await refreshBuildingVrCatalog();
    syncRoomListVrFilterOptions(rooms);
  } catch (err) {
    console.warn("building VR catalog refresh failed", err);
  }
  if (activeSection?.id !== sec.id) return;
  drawOverlay();
  if (roomsErr && pdfErr) {
    setStatus(
      `${roomsErr instanceof Error ? roomsErr.message : String(roomsErr)} \xB7 ${pdfErr instanceof Error ? pdfErr.message : String(pdfErr)}`,
      "err"
    );
  } else if (roomsErr) {
    setStatus(roomsErr instanceof Error ? roomsErr.message : String(roomsErr), "err");
  } else if (pdfErr) {
    setStatus(pdfErr instanceof Error ? pdfErr.message : String(pdfErr), "err");
  } else {
    setStatus(
      `${n.title} klaar \u2014 ${rooms.length} ${rooms.length === 1 ? n.singular : n.plural}`,
      "ok"
    );
  }
  await restoreAfterCatalogReturn();
}
async function loadCroppedPdf(sec) {
  const res = await fetch(`/api/drawings/download?document_id=${encodeURIComponent(sec.document_id)}`, {
    credentials: "include",
    headers: apiAuthHeaders(auth().token)
  });
  if (!res.ok) throw new Error(`PDF laden mislukt (HTTP ${res.status})`);
  const buf = await res.arrayBuffer();
  const pdfjsLib = window.pdfjsLib;
  if (!pdfjsLib) throw new Error("PDF.js not loaded");
  ensurePdfjsWorker();
  pdfDoc = await pdfjsLib.getDocument({ data: buf }).promise;
  const pageNum = Math.min(pdfDoc.numPages, Math.max(1, sec.page_index + 1));
  const page = await pdfDoc.getPage(pageNum);
  const renderScale = CROP_VIEW_RENDER_SCALE;
  const pageRotate = typeof page.rotate === "number" ? page.rotate : 0;
  const viewRotate = Number(sec.view_rotate) || 0;
  const rotation = (pageRotate + viewRotate) % 360;
  const viewport = page.getViewport({ scale: renderScale, rotation });
  const off = document.createElement("canvas");
  off.width = Math.floor(viewport.width);
  off.height = Math.floor(viewport.height);
  const octx = off.getContext("2d");
  if (!octx) throw new Error("canvas context unavailable");
  octx.setTransform(1, 0, 0, 1, 0, 0);
  await page.render({ canvasContext: octx, viewport }).promise;
  const x0 = Math.floor(sec.x_min * off.width);
  const y0 = Math.floor(sec.y_min * off.height);
  const x1 = Math.ceil(sec.x_max * off.width);
  const y1 = Math.ceil(sec.y_max * off.height);
  const cw = Math.max(1, x1 - x0);
  const ch = Math.max(1, y1 - y0);
  cropBitmap = document.createElement("canvas");
  cropBitmap.width = cw;
  cropBitmap.height = ch;
  const cctx = cropBitmap.getContext("2d");
  if (!cctx) throw new Error("crop context unavailable");
  cctx.drawImage(off, x0, y0, cw, ch, 0, 0, cw, ch);
  const baseVp = page.getViewport({ scale: 1 });
  cropWidthPdfPts = (sec.x_max - sec.x_min) * baseVp.width;
  viewZoom = loadStoredViewZoom();
  await paintCropView();
}
async function tryDetectPdfScale(sec) {
  if (!pdfDoc) return;
  if (sec.metres_per_norm_unit != null && sec.metres_per_norm_unit > 0) return;
  try {
    const page = await pdfDoc.getPage(Math.min(pdfDoc.numPages, Math.max(1, sec.page_index + 1)));
    const content = await page.getTextContent();
    const base = page.getViewport({ scale: 1 });
    let found = null;
    for (const item of content.items) {
      const str = item.str || "";
      const ratio = parseScaleRatioFromText(str);
      if (ratio == null) continue;
      const t = item.transform;
      if (t && t.length >= 6) {
        const px = t[4] / base.width;
        const py = 1 - t[5] / base.height;
        if (px < sec.x_min - 0.02 || px > sec.x_max + 0.02 || py < sec.y_min - 0.02 || py > sec.y_max + 0.02) {
          continue;
        }
      }
      found = ratio;
      break;
    }
    if (found == null || !(cropWidthPdfPts > 0)) return;
    const mpu = metresPerNormFromPaperScale(found, cropWidthPdfPts);
    const aspect = activeScaleAspect();
    await persistSectionScale({
      section_id: sec.id,
      metres_per_norm_unit: mpu,
      scale_ratio: found,
      scale_source: "PDF_TEXT",
      scale_aspect_yx: aspect
    });
    sec.metres_per_norm_unit = mpu;
    sec.scale_aspect_yx = aspect;
    sec.scale_ratio = found;
    sec.scale_source = "PDF_TEXT";
    activeSection = sec;
    const idx = sections.findIndex((s) => s.id === sec.id);
    if (idx >= 0) sections[idx] = sec;
    calibrateHintEl.textContent = `Gedetecteerde papierschaal 1:${found} uit PDF-tekst.`;
  } catch {
  }
}
async function paintCropView() {
  if (!cropBitmap) return;
  canvasWidth = Math.max(1, Math.floor(cropBitmap.width * viewZoom));
  canvasHeight = Math.max(1, Math.floor(cropBitmap.height * viewZoom));
  pdfCanvas.width = canvasWidth;
  pdfCanvas.height = canvasHeight;
  overlayCanvas.width = canvasWidth;
  overlayCanvas.height = canvasHeight;
  const ctx = pdfCanvas.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(cropBitmap, 0, 0, canvasWidth, canvasHeight);
  const cssW = `${canvasWidth}px`;
  const cssH = `${canvasHeight}px`;
  pdfCanvas.style.width = cssW;
  pdfCanvas.style.height = cssH;
  overlayCanvas.style.width = cssW;
  overlayCanvas.style.height = cssH;
  zoomLabelEl.textContent = `${Math.round(viewZoom * 100)}%`;
  drawOverlay();
}
function updateZoomLabel() {
  zoomLabelEl.textContent = `${Math.round(viewZoom * 100)}%`;
}
async function setViewZoom(next, maxZoom = ZOOM_MAX_DETAIL) {
  const rounded = Math.round(next * 100) / 100;
  viewZoom = Math.min(maxZoom, Math.max(ZOOM_MIN, rounded));
  persistViewZoom(viewZoom);
  updateZoomLabel();
  await paintCropView();
}
async function zoomToFit() {
  if (!cropBitmap) return;
  const avail = Math.max(200, pdfScrollEl.clientWidth - 16);
  await setViewZoom(avail / cropBitmap.width, ZOOM_MAX);
}
function canvasToNorm2(cx, cy) {
  return canvasToNorm(cx, cy, canvasWidth, canvasHeight);
}
function canvasToNormUnclamped2(cx, cy) {
  return canvasToNormUnclamped(cx, cy, canvasWidth, canvasHeight);
}
function normToCanvas2(p) {
  return normToCanvas(p, canvasWidth, canvasHeight);
}
function eventToCanvas2(ev) {
  return eventToCanvas(ev, overlayCanvas.getBoundingClientRect(), canvasWidth, canvasHeight);
}
function drawPolyline(ctx, points, stroke, fill, lineWidth, opts) {
  if (points.length < 2) return;
  const holes = (opts?.holes || []).filter((h) => h.length >= 3);
  const open = Boolean(opts?.open);
  const strokeOnly = Boolean(opts?.strokeOnly) || !fill;
  ctx.beginPath();
  const first = normToCanvas2(points[0]);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < points.length; i++) {
    const p = normToCanvas2(points[i]);
    ctx.lineTo(p.x, p.y);
  }
  if (!open) ctx.closePath();
  for (const hole of holes) {
    const h0 = normToCanvas2(hole[0]);
    ctx.moveTo(h0.x, h0.y);
    for (let i = 1; i < hole.length; i++) {
      const p = normToCanvas2(hole[i]);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
  }
  if (fill && !strokeOnly) {
    ctx.fillStyle = fill;
    ctx.fill(holes.length ? "evenodd" : "nonzero");
  }
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  if (opts?.dash?.length) ctx.setLineDash(opts.dash);
  else ctx.setLineDash([]);
  ctx.stroke();
  ctx.setLineDash([]);
  if (opts?.vertexHandles) {
    const verts = points.length > 1 && Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y) < 1e-6 ? points.slice(0, -1) : points;
    const hr = vertexHandleRadiusPx2();
    for (const pt of verts) {
      const c = normToCanvas2(pt);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.strokeStyle = "#00bcd4";
      ctx.lineWidth = detail ? 1.5 : 1;
      ctx.beginPath();
      ctx.arc(c.x, c.y, hr, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  if (opts?.label) {
    const xs = points.map((p) => normToCanvas2(p).x);
    const ys = points.map((p) => normToCanvas2(p).y);
    const lx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const ly = Math.min(...ys) - 8;
    ctx.fillStyle = stroke;
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(opts.label, lx, Math.max(12, ly));
  }
}
function sourceIdsHiddenForComposeNetPreview() {
  const hide = /* @__PURE__ */ new Set();
  const addSourcesOf = (compose) => {
    const src = compose.analysis?.source_subsection_ids;
    if (!Array.isArray(src)) return;
    for (const sid of src) {
      if (sid && sid !== compose.id) hide.add(sid);
    }
  };
  if (pendingRoom?.editingId) {
    const editing = rooms.find((r) => r.id === pendingRoom.editingId);
    if (editing && isComposeResultRoom(editing)) addSourcesOf(editing);
  }
  for (const id of selectedSetIds) {
    const r = rooms.find((x) => x.id === id);
    if (!r || !isComposeResultRoom(r)) continue;
    const src = r.analysis?.source_subsection_ids || [];
    if (src.some((sid) => sid && selectedSetIds.has(sid))) continue;
    addSourcesOf(r);
  }
  return hide;
}
function drawOverlay() {
  const ctx = overlayCanvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  const hideSourceIds = sourceIdsHiddenForComposeNetPreview();
  const drawSavedRoom = (r) => {
    if (!r.points?.length) return;
    if (isLocallyDeleted(r.id)) return;
    if (pendingRoom?.editingId === r.id) return;
    if (!roomMatchesVrFilter(r, roomListVrFilter)) return;
    if (hideSourceIds.has(r.id)) return;
    const selected = selectedSetIds.has(r.id);
    const touched = touchedRoomIds.has(normRoomId(r.id));
    const holes = Array.isArray(r.analysis?.holes) ? r.analysis.holes.map((h) => coerceRingPoints(h)).filter((h) => h.length >= 3) : [];
    const lengthComp = componentIsLengthQuantity(r);
    const stroke = selected ? "#1565c0" : touched ? "#00838f" : "#6a1b9a";
    const fill = lengthComp ? "" : selected ? "rgba(21,101,192,0.22)" : touched ? "rgba(0,131,143,0.16)" : "rgba(106,27,154,0.12)";
    const width = selected ? 2.6 : touched ? 2.2 : 2;
    drawPolyline(ctx, r.points, stroke, fill, width, {
      holes: lengthComp ? void 0 : holes.length ? holes : void 0,
      open: Boolean(r.analysis?.open_path) || lengthComp && r.points.length < 3,
      strokeOnly: lengthComp
    });
  };
  const drawSealStroke = (r, points) => {
    if (!points?.length) return;
    if (!roomMatchesVrFilter(r, roomListVrFilter)) return;
    if (hideSourceIds.has(r.id)) return;
    const selected = selectedSetIds.has(r.id);
    const touched = touchedRoomIds.has(normRoomId(r.id));
    const stroke = selected ? KIER_SEAL_STROKE_SELECTED : touched ? KIER_SEAL_STROKE_TOUCHED : KIER_SEAL_STROKE;
    const holes = Array.isArray(r.analysis?.holes) ? r.analysis.holes.map((h) => coerceRingPoints(h)).filter((h) => h.length >= 3) : [];
    const live = pendingRoom?.editingId === r.id ? pendingRoom : null;
    const liveHoles = live?.holes;
    drawPolyline(ctx, points, stroke, "", 3.4, {
      holes: liveHoles && liveHoles.length ? liveHoles : holes.length ? holes : void 0,
      open: Boolean(r.analysis?.open_path) || (live ? !live.closed : false),
      strokeOnly: true
    });
  };
  for (const r of rooms) {
    if (isLegacySealSibling(r.analysis)) continue;
    drawSavedRoom(r);
  }
  if (booleanPreview && booleanPreview.outer.length >= 3) {
    const mpu = activeScaleMpu();
    const areaBit = mpu != null ? ` ${scaledAreaM2(booleanPreview.areaNorm, mpu, activeScaleAspect()).toFixed(2)} m\xB2` : "";
    drawPolyline(ctx, booleanPreview.outer, "#2e7d32", "rgba(46,125,50,0.28)", 2.5, {
      dash: [6, 3],
      label: `\xB1${areaBit}`,
      holes: booleanPreview.holes
    });
  }
  drawDetailOverlay(ctx);
  if (discovery) {
    discovery.candidates.forEach((ring, i) => {
      if (i === discovery.index) return;
      drawPolyline(ctx, ring, "#9e9e9e", "rgba(158,158,158,0.06)", 1.5, { dash: [4, 4] });
    });
    if (discovery.current.length >= 2) {
      drawPolyline(ctx, discovery.current, "#c62828", "rgba(198,40,40,0.12)", 2.5, {
        dash: [8, 4],
        vertexHandles: true,
        label: `Kandidaat ${discovery.index + 1}`
      });
    }
  }
  if (pendingRoom?.points.length) {
    const lengthEdit = pendingIsLengthComponent();
    const drawingOpen = Boolean(pendingRoom.drawing && !pendingRoom.closed);
    drawPolyline(
      ctx,
      pendingRoom.points,
      "#2e7d32",
      lengthEdit || !pendingRoom.closed ? "" : "rgba(46,125,50,0.18)",
      lengthEdit ? 2.8 : 2,
      {
        vertexHandles: !drawingOpen && (pendingRoom.closed || pendingRoom.points.length >= 2),
        holes: lengthEdit ? void 0 : pendingRoom.holes,
        open: !pendingRoom.closed,
        strokeOnly: lengthEdit || !pendingRoom.closed
      }
    );
    if (drawingOpen) drawOpenPolygonDraft(ctx, pendingRoom);
  }
  for (const r of rooms) {
    if (isLocallyDeleted(r.id)) continue;
    if (isLegacySealSibling(r.analysis)) {
      if (r.points?.length) drawSealStroke(r, r.points);
      continue;
    }
    if (!componentSealEnabled(r.analysis)) continue;
    const pts = pendingRoom?.editingId === r.id && pendingRoom.points.length ? pendingRoom.points : r.points;
    if (pts?.length) drawSealStroke(r, pts);
  }
  if (calibrate?.points.length) {
    ctx.strokeStyle = "#1565c0";
    ctx.fillStyle = "#1565c0";
    ctx.lineWidth = 2;
    for (let i = 0; i < calibrate.points.length; i++) {
      const c = normToCanvas2(calibrate.points[i]);
      ctx.beginPath();
      ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
      ctx.fill();
      if (i === 1) {
        const a = normToCanvas2(calibrate.points[0]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(c.x, c.y);
        ctx.stroke();
      }
    }
  }
  if (measure.tool === "length") {
    const pts = measureDisplayPoints();
    if (pts.length > 0) {
      ctx.strokeStyle = "#0277bd";
      ctx.fillStyle = "#0277bd";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      const first = normToCanvas2(pts[0]);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < pts.length; i++) {
        const p = normToCanvas2(pts[i]);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      for (const pt of measure.points) {
        const c = normToCanvas2(pt);
        ctx.beginPath();
        ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#0277bd";
        ctx.fill();
      }
    }
  }
}
function seedStarterRoom() {
  return ensureEditablePolyline(
    [
      { x: 0.28, y: 0.28 },
      { x: 0.72, y: 0.28 },
      { x: 0.72, y: 0.72 },
      { x: 0.28, y: 0.72 }
    ],
    20
  );
}
function scrollToRing(points) {
  if (!points.length || canvasWidth <= 0 || canvasHeight <= 0) return;
  const xs = points.map((p) => p.x * canvasWidth);
  const ys = points.map((p) => p.y * canvasHeight);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const viewL = pdfScrollEl.scrollLeft;
  const viewT = pdfScrollEl.scrollTop;
  const viewW = pdfScrollEl.clientWidth;
  const viewH = pdfScrollEl.clientHeight;
  const viewR = viewL + viewW;
  const viewB = viewT + viewH;
  const pad = 32;
  const visible = maxX >= viewL + pad && minX <= viewR - pad && maxY >= viewT + pad && minY <= viewB - pad;
  if (visible) return;
  let left = viewL;
  let top = viewT;
  if (minX < viewL + pad) left = Math.max(0, minX - pad);
  else if (maxX > viewR - pad) left = Math.max(0, maxX - viewW + pad);
  if (minY < viewT + pad) top = Math.max(0, minY - pad);
  else if (maxY > viewB - pad) top = Math.max(0, maxY - viewH + pad);
  if (left !== viewL || top !== viewT) {
    pdfScrollEl.scrollTo({ top, left, behavior: "auto" });
  }
}
function syncDetailFactorButtons() {
  const factor = detail?.factor ?? DETAIL_FACTOR_DEFAULT;
  document.querySelectorAll(".detail-factor-btn").forEach((btn) => {
    const f = Number(btn.dataset.factor);
    btn.classList.toggle("active", f === factor);
  });
}
function updateDetailDock() {
  if (!detailDockEl) return;
  const picking = Boolean(detailPick);
  const active = Boolean(detail);
  detailDockEl.classList.toggle("hidden", !picking && !active);
  if (detailBtn) {
    detailBtn.classList.toggle("active", picking || active);
    detailBtn.textContent = picking ? "Annuleer markeren" : active ? "Detailgebied aan" : "Detailgebied";
  }
  if (detailHintEl) {
    if (picking) {
      detailHintEl.textContent = "Sleep een rechthoek over het gebied met kleine componenten, laat los om te vergroten.";
    } else if (detail) {
      const pct = Math.round(detail.baseZoom * detail.factor * 100);
      detailHintEl.textContent = detail.factor === 1 ? `Actief \xB7 1\xD7 (${pct}%) \u2014 overzicht bij markeren; kies 2\xD7/3\xD7/4\xD7 om in te zoomen.` : `Actief \xB7 ${detail.factor}\xD7 (${pct}%) \u2014 1\xD7 keert terug naar overzicht; Sluiten wist het kader.`;
    } else {
      detailHintEl.textContent = "Start op 1\xD7 (overzicht). Sleep een rechthoek; daarna 2\xD7/3\xD7/4\xD7 t.o.v. dat overzicht. Rechterlijst blijft zichtbaar.";
    }
  }
  syncDetailFactorButtons();
  if (detailRepickBtn) detailRepickBtn.disabled = picking;
}
async function applyDetailView(opts) {
  if (!detail || !cropBitmap) return;
  const target = detail.baseZoom * detail.factor;
  await setViewZoom(target, ZOOM_MAX_DETAIL);
  if (opts?.scroll !== false) {
    scrollToRing(normRectRing(detail.rect));
  }
  updateDetailDock();
  drawOverlay();
  setStatus(
    detail.factor === 1 ? `Detailgebied 1\xD7 (${Math.round(viewZoom * 100)}% \u2014 overzicht)` : `Detailgebied ${detail.factor}\xD7 (${Math.round(viewZoom * 100)}%)`,
    "ok"
  );
}
async function endDetail(msg) {
  const restore = detail ? {
    z: detail.baseZoom,
    left: detail.baseScrollLeft,
    top: detail.baseScrollTop
  } : null;
  detail = null;
  detailPick = null;
  overlayCanvas.style.cursor = "";
  if (restore) {
    await setViewZoom(restore.z);
    pdfScrollEl.scrollTo({
      left: restore.left,
      top: restore.top,
      behavior: "auto"
    });
  }
  updateDetailDock();
  drawOverlay();
  if (msg) setStatus(msg, "ok");
}
async function beginDetailPick() {
  endCalibrate();
  if (discovery) {
    setStatus("Rond ontdekken eerst af of annuleer v\xF3\xF3r detailzoom", "err");
    return;
  }
  if (cropBitmap) {
    await zoomToFit();
  } else {
    await setViewZoom(1, ZOOM_MAX);
  }
  pdfScrollEl.scrollTo({ left: 0, top: 0, behavior: "auto" });
  detailPick = {
    start: { x: 0, y: 0 },
    current: { x: 0, y: 0 },
    armed: true
  };
  overlayCanvas.style.cursor = "crosshair";
  updateDetailDock();
  setStatus("Detailgebied 1\xD7 \u2014 sleep een rechthoek op het overzicht", "busy");
  drawOverlay();
}
function startDetailTool() {
  void (async () => {
    if (detailPick) {
      await endDetail("Detailgebied geannuleerd");
      return;
    }
    if (detail) {
      await endDetail("Detailgebied gesloten");
      return;
    }
    await beginDetailPick();
  })();
}
function repickDetail() {
  void (async () => {
    detail = null;
    await beginDetailPick();
  })();
}
async function commitDetailRect(rect, factor = DETAIL_FACTOR_DEFAULT) {
  if (!normRectSizeOk(rect)) {
    setStatus("Gebied te klein \u2014 sleep een grotere rechthoek", "err");
    detailPick = null;
    void beginDetailPick();
    return;
  }
  detailPick = null;
  overlayCanvas.style.cursor = "";
  detail = {
    rect,
    factor,
    baseZoom: viewZoom,
    baseScrollLeft: pdfScrollEl.scrollLeft,
    baseScrollTop: pdfScrollEl.scrollTop
  };
  await applyDetailView();
}
function drawDetailOverlay(ctx) {
  const live = detailPick && !detailPick.armed ? normalizeNormRect(detailPick.start, detailPick.current) : detail?.rect || null;
  if (!live) return;
  const x = live.x0 * canvasWidth;
  const y = live.y0 * canvasHeight;
  const w = (live.x1 - live.x0) * canvasWidth;
  const h = (live.y1 - live.y0) * canvasHeight;
  if (w < 1 || h < 1) return;
  ctx.save();
  ctx.fillStyle = "rgba(15, 23, 32, 0.28)";
  ctx.beginPath();
  ctx.rect(0, 0, canvasWidth, canvasHeight);
  ctx.rect(x, y, w, h);
  ctx.fill("evenodd");
  ctx.strokeStyle = detailPick ? "#0288d1" : "#1565c0";
  ctx.lineWidth = 2;
  ctx.setLineDash(detailPick ? [7, 4] : []);
  ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
  ctx.setLineDash([]);
  ctx.restore();
}
function endDiscovery(msg) {
  discovery = null;
  discoveryDockEl.classList.add("hidden");
  document.body.classList.remove("discovery-active");
  syncEditDock();
  if (msg) setStatus(msg, "ok");
  updateMeasureReadouts();
  updateToolHint();
  drawOverlay();
}
function showDiscoveryCandidate() {
  if (!discovery) return;
  const total = discovery.candidates.length;
  const i = discovery.index;
  if (i >= total) {
    endDiscovery(
      total === 0 ? "Ontdekken afgerond" : `Ontdekken afgerond \u2014 ${total} kandidaat(en) beoordeeld`
    );
    return;
  }
  discovery.current = ensureEditablePolyline(
    discovery.candidates[i].map((p) => ({ ...p })),
    16
  );
  discovery.candidates[i] = discovery.current;
  discovery.dragVertex = null;
  discoveryProgressEl.textContent = `(${i + 1} van ${total})`;
  discoveryHintEl.textContent = "Sleep ankers langs de muren. Dubbelklik op een rand om een anker toe te voegen; dubbelklik een anker om te verwijderen; of Vereenvoudigen.";
  discoveryLabelInput.value = buildDiscoveryLabel(activePartNoun().singular, rooms.length);
  discoveryDockEl.classList.remove("hidden");
  document.body.classList.add("discovery-active");
  if (editDockEl) editDockEl.classList.add("hidden");
  updateMeasureReadouts();
  updateToolHint();
  drawOverlay();
  scrollToRing(discovery.current);
}
function discoverMinAreaFraction() {
  if (!discoverMinSizeEl) return 0;
  const pos = Number(discoverMinSizeEl.value);
  const inverted = Number.isFinite(pos) ? 100 - pos : 100;
  return discoverMinAreaFractionFromPercent(inverted);
}
function updateDiscoverFilterAria() {
  if (!discoverMinSizeEl) return;
  const pos = Number(discoverMinSizeEl.value);
  if (!Number.isFinite(pos)) return;
  const coarse = pos <= 33;
  const fine = pos >= 67;
  discoverMinSizeEl.setAttribute(
    "aria-valuetext",
    coarse ? "Grof" : fine ? "Fijn" : "Middel"
  );
}
function resolveDiscoveryOuter2() {
  return resolveDiscoveryOuter({
    isFloormapKind: isFloormapKind(),
    pendingRoom,
    rooms,
    selectedSetIds,
    closeRing,
    isLengthComponent: componentIsLengthQuantity,
    differenceSubject
  });
}
function openingOverlapsExisting2(normRing, outerId) {
  return openingOverlapsExisting(normRing, outerId, rooms, shoelaceArea, componentIsLengthQuantity);
}
async function autoSaveDiscoveredOpenings(openings, outer) {
  if (!activeSection || !auth() || !cropBitmap) return 0;
  const mpu = activeScaleMpu();
  const aspect = activeScaleAspect();
  const level = outer.level_hint || roomLevelSelect.value || "OTHER";
  const vg = outer.vg_nr != null ? Number(outer.vg_nr) : parseVgVrInputs().vg_nr;
  const vr = outer.vr_nr != null && String(outer.vr_nr).trim() ? String(outer.vr_nr).trim() : parseVgVrInputs().vr_nr;
  let savedN = 0;
  for (const o of openings) {
    const points = discoveredOpeningToSectionPoints(
      pixelsToSectionNorm(o.points, cropBitmap.width, cropBitmap.height),
      o.shape
    );
    if (!ringFullyContained(points, outer.points)) continue;
    if (openingOverlapsExisting2(points, outer.id)) continue;
    const body = {
      section_id: activeSection.id,
      label: o.suggestedLabel,
      level_hint: level,
      vg_nr: vg,
      vr_nr: vr,
      points,
      metres_per_norm_unit: mpu ?? void 0,
      scale_aspect_yx: aspect,
      analysis: {
        discovered_from_outer_id: outer.id,
        discovery_kind: o.kind
      }
    };
    const saved = await saveDrawingSubsection(body);
    const savedId = (saved.subsection_id || "").trim();
    if (!savedId) continue;
    markRoomTouched(savedId);
    const analysis = {
      discovered_from_outer_id: outer.id,
      discovery_kind: o.kind,
      ...saved.analysis || {}
    };
    const patched = {
      id: savedId,
      section_id: activeSection.id,
      label: o.suggestedLabel,
      level_hint: level,
      vg_nr: vg,
      vr_nr: vr,
      points: points.map((p) => ({ ...p })),
      area_m2: saved.area_m2 != null ? Number(saved.area_m2) : null,
      area_norm: saved.area_norm != null ? Number(saved.area_norm) : null,
      perimeter_m: saved.perimeter_m != null ? Number(saved.perimeter_m) : null,
      perimeter_norm: null,
      metres_per_norm_unit: mpu,
      analysis_status: "ok",
      sort_order: rooms.length,
      analysis
    };
    rooms = [...rooms.filter((r) => r.id !== savedId), patched];
    noteLocalRoomPatch(patched);
    savedN++;
  }
  if (savedN > 0) {
    roomsLoadEpoch += 1;
    renderRoomList();
    drawOverlay();
  }
  return savedN;
}
var DISCOVER_PRESS_MS = 180;
var CROP_VIEW_RENDER_SCALE = 2.5;
var DISCOVER_HIRES_RENDER_SCALE = 6;
var DISCOVER_SERVER_MAX_WORK_DIM = 2048;
var discoverPressUntil = 0;
function setDiscoverBusy(on) {
  for (const btn of [discoverBtn, discoverBtnSide]) {
    if (!btn) continue;
    btn.classList.toggle("is-busy", on);
    btn.disabled = on;
    btn.setAttribute("aria-busy", on ? "true" : "false");
  }
}
function beginDiscoverPress() {
  setDiscoverBusy(true);
  discoverPressUntil = Date.now() + DISCOVER_PRESS_MS;
}
function endDiscoverPress() {
  const left = discoverPressUntil - Date.now();
  if (left > 0) {
    window.setTimeout(() => setDiscoverBusy(false), left);
  } else {
    setDiscoverBusy(false);
  }
}
function formatDiscoverKindCounts(meta) {
  if (!meta?.kindCounts) return "";
  const parts = [];
  const { kindCounts } = meta;
  if (kindCounts.line_rect) parts.push(`${kindCounts.line_rect}\xD7 lijn-kader`);
  if (kindCounts.dark_fill) parts.push(`${kindCounts.dark_fill}\xD7 vulling`);
  if (kindCounts.paper_pocket) parts.push(`${kindCounts.paper_pocket}\xD7 pocket`);
  return parts.join(", ");
}
function formatDiscoverDiag(usedServer, meta, serverError) {
  if (serverError) return `server mislukt (${serverError}) \xB7 lokaal`;
  if (!meta) return usedServer ? "hi-res server" : "lokaal";
  const kinds = formatDiscoverKindCounts(meta);
  const axes = `lijn-assen ${meta.lineWorkW}\xD7${meta.lineWorkH}px`;
  const input = `invoer ${meta.inputW}\xD7${meta.inputH}px`;
  const src = usedServer ? "server" : "lokaal";
  return [src, input, axes, kinds].filter(Boolean).join(" \xB7 ");
}
async function discoverFacadeOpeningsViaServer(outer) {
  if (!activeSection || !auth()?.token) {
    return { openings: null, error: "niet ingelogd" };
  }
  try {
    const body = await apiPost(
      "/api/floormap/discover-openings",
      {
        section_id: activeSection.id,
        outer_points: outer.points,
        min_area_fraction: discoverMinAreaFraction(),
        max_work_dim: DISCOVER_SERVER_MAX_WORK_DIM,
        max_line_work_dim: DISCOVER_SERVER_MAX_WORK_DIM,
        render_scale: DISCOVER_HIRES_RENDER_SCALE
      },
      { timeoutMs: 18e4 }
    );
    return {
      openings: (body.openings || []).map((o) => ({
        points: o.points.map((p) => ({ x: p.x, y: p.y })),
        areaPx: o.areaPx,
        kind: o.kind,
        shape: o.shape,
        circularity: o.circularity,
        suggestedLabel: o.suggestedLabel
      })),
      meta: body.meta,
      serverWidth: body.width,
      serverHeight: body.height
    };
  } catch (err) {
    return {
      openings: null,
      error: err instanceof Error ? err.message : String(err)
    };
  }
}
function mapHiResOpeningsToCrop(openings, hiResW, hiResH, cropW, cropH) {
  const scaleX = cropW / Math.max(1, hiResW);
  const scaleY = cropH / Math.max(1, hiResH);
  const areaScale = scaleX * scaleY;
  return openings.map((o) => ({
    ...o,
    points: o.points.map((p) => ({ x: p.x * scaleX, y: p.y * scaleY })),
    areaPx: o.areaPx * areaScale
  }));
}
async function startDiscovery() {
  beginDiscoverPress();
  try {
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    if (!cropBitmap || !activeSection) {
      setStatus(`Open eerst een ${activePartNoun().title.toLowerCase()}`, "err");
      return;
    }
    endCalibrate();
    void endDetail();
    if (measure.tool !== "off") clearMeasure(false);
    const sample = document.createElement("canvas");
    sample.width = cropBitmap.width;
    sample.height = cropBitmap.height;
    const sampleCtx = sample.getContext("2d", { willReadFrequently: true });
    if (!sampleCtx) {
      setStatus("Tekeningbeeld kan niet worden gelezen", "err");
      return;
    }
    sampleCtx.drawImage(cropBitmap, 0, 0);
    const img = sampleCtx.getImageData(0, 0, sample.width, sample.height);
    if (!isFloormapKind()) {
      const outer = resolveDiscoveryOuter2();
      if (!outer || outer.points.length < 3) {
        setStatus(
          "Selecteer eerst de buitencontour in de lijst (checkbox), of open die ter bewerking \u2014 daarna Ontdek openingen",
          "err"
        );
        return;
      }
      setStatus(`Openingen zoeken (hi-res) in \xAB${outer.label || "buitencontour"}\xBB\u2026`, "busy");
      let found2 = [];
      let usedServer = false;
      let discoverMeta;
      let serverError;
      try {
        const serverResult = await discoverFacadeOpeningsViaServer(outer);
        serverError = serverResult.error;
        if (serverResult.openings !== null && serverResult.serverWidth && serverResult.serverHeight) {
          found2 = mapHiResOpeningsToCrop(
            serverResult.openings,
            serverResult.serverWidth,
            serverResult.serverHeight,
            cropBitmap.width,
            cropBitmap.height
          );
          discoverMeta = serverResult.meta;
          usedServer = true;
        }
      } catch (err) {
        serverError = err instanceof Error ? err.message : String(err);
      }
      if (!usedServer) {
        if (serverError) {
          setStatus(`Server ontdekken mislukt (${serverError}) \u2014 lokaal\u2026`, "busy");
        } else {
          setStatus(`Openingen zoeken (lokaal) in \xAB${outer.label || "buitencontour"}\xBB\u2026`, "busy");
        }
        const localMeta = {
          inputW: 0,
          inputH: 0,
          workW: 0,
          workH: 0,
          lineWorkW: 0,
          lineWorkH: 0,
          kindCounts: { dark_fill: 0, paper_pocket: 0, line_rect: 0 }
        };
        try {
          found2 = discoverInteriorOpenings(img, outer.points, {
            minAreaFraction: discoverMinAreaFraction(),
            meta: localMeta
          });
          discoverMeta = localMeta;
        } catch (err) {
          setStatus(err instanceof Error ? err.message : "Ontdekken mislukt", "err");
          return;
        }
      }
      await paintCropView();
      if (!found2.length) {
        setStatus(
          "Geen openingen in de bitmap gevonden binnen deze buitencontour \u2014 teken handmatig of controleer contrast",
          "err"
        );
        return;
      }
      try {
        const n = await autoSaveDiscoveredOpenings(found2, outer);
        selectedSetIds.clear();
        constituentSigns.clear();
        booleanPreview = null;
        await loadRooms();
        fillVgVrSuggestions();
        drawOverlay();
        syncPendingRoomButtons();
        const diag = formatDiscoverDiag(usedServer, discoverMeta, usedServer ? void 0 : serverError);
        setStatus(
          n > 0 ? `${n} opening(en) toegevoegd onder VG ${outer.vg_nr ?? "?"} \xB7 VR ${outer.vr_nr ?? "?"} (${diag})` : `Kandidaten overlapten bestaande componenten \u2014 niets nieuws (${diag})`,
          n > 0 ? "ok" : "busy"
        );
      } catch (err) {
        setStatus(err instanceof Error ? err.message : String(err), "err");
      }
      return;
    }
    clearPendingRoom();
    setStatus(`${activePartNoun().plural.charAt(0).toUpperCase() + activePartNoun().plural.slice(1)} ontdekken\u2026`, "busy");
    let found = [];
    try {
      found = discoverRoomPolylines(img);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Ontdekken mislukt", "err");
      return;
    }
    await paintCropView();
    let norms = found.map(
      (r) => ensureEditablePolyline(
        pixelsToSectionNorm(r.points, cropBitmap.width, cropBitmap.height),
        16
      )
    );
    let seeded = false;
    if (norms.length === 0) {
      norms = [seedStarterRoom()];
      seeded = true;
    }
    discovery = { candidates: norms, index: 0, current: [], dragVertex: null };
    showDiscoveryCandidate();
    setStatus(
      seeded ? "Geen ruimten automatisch gevonden \u2014 pas de rode startomtrek aan op een ruimte, daarna Accepteren" : `${norms.length} ruimte-kandidaat(en) \u2014 sleep de rode stippellijn passend, daarna Accepteren / Overslaan`,
      seeded ? "busy" : "ok"
    );
  } finally {
    endDiscoverPress();
  }
}
async function acceptDiscovery() {
  if (!discovery || !activeSection || !auth()) return;
  const points = closeRing(discovery.current);
  const label = discoveryLabelInput.value.trim() || buildDiscoveryLabel(activePartNoun().singular, rooms.length);
  const level = discoveryLevelSelect.value || "OTHER";
  if (isFloormapKind()) {
    let nums = parseVgVrInputs();
    if (nums.vg_nr == null || nums.vr_nr == null) {
      fillVgVrSuggestions();
      nums = parseVgVrInputs();
    }
    if (nums.error || nums.vg_nr == null || nums.vr_nr == null) {
      setStatus(nums.error || "Vul VG- en VR-nummer in (zijbalk) v\xF3\xF3r Accepteren", "err");
      return;
    }
    discoveryAcceptBtn.disabled = true;
    setStatus("Ruimte opslaan\u2026", "busy");
    try {
      const mpu = activeScaleMpu();
      const saved = await saveDrawingSubsection({
        section_id: activeSection.id,
        label,
        level_hint: level,
        vg_nr: nums.vg_nr,
        vr_nr: nums.vr_nr,
        points,
        metres_per_norm_unit: mpu ?? void 0,
        scale_aspect_yx: activeScaleAspect()
      });
      markRoomTouched(saved.subsection_id);
      noteLocalLabel(saved.subsection_id, label);
      upsertOptimisticRoom({
        id: saved.subsection_id,
        section_id: activeSection.id,
        label,
        level_hint: level,
        vg_nr: nums.vg_nr,
        vr_nr: nums.vr_nr,
        points: points.map((p) => ({ ...p })),
        area_m2: saved.area_m2 != null ? Number(saved.area_m2) : null,
        area_norm: saved.area_norm != null ? Number(saved.area_norm) : null,
        perimeter_m: saved.perimeter_m != null ? Number(saved.perimeter_m) : null,
        perimeter_norm: null,
        metres_per_norm_unit: mpu,
        analysis_status: "ok",
        sort_order: rooms.length,
        analysis: saved.analysis || null
      });
      roomsLoadEpoch += 1;
      await loadRooms({ preserveOrder: true });
      fillVgVrSuggestions();
      discovery.index += 1;
      showDiscoveryCandidate();
      if (discovery && discovery.index < discovery.candidates.length) {
        setStatus(
          `Opgeslagen ${label} \u2014 volgende kandidaat (${discovery.index + 1} van ${discovery.candidates.length})`,
          "ok"
        );
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err), "err");
    } finally {
      discoveryAcceptBtn.disabled = false;
    }
    return;
  }
  const vgVr = parseVgVrInputs();
  if (vgVr.error) {
    setStatus(vgVr.error, "err");
    return;
  }
  discoveryAcceptBtn.disabled = true;
  setStatus("Component opslaan\u2026", "busy");
  try {
    const mpu = activeScaleMpu();
    const saved = await saveDrawingSubsection({
      section_id: activeSection.id,
      label,
      level_hint: level,
      vg_nr: vgVr.vg_nr,
      vr_nr: vgVr.vr_nr,
      points,
      metres_per_norm_unit: mpu ?? void 0,
      scale_aspect_yx: activeScaleAspect()
    });
    markRoomTouched(saved.subsection_id);
    noteLocalLabel(saved.subsection_id, label);
    upsertOptimisticRoom({
      id: saved.subsection_id,
      section_id: activeSection.id,
      label,
      level_hint: level,
      vg_nr: vgVr.vg_nr,
      vr_nr: vgVr.vr_nr,
      points: points.map((p) => ({ ...p })),
      area_m2: saved.area_m2 != null ? Number(saved.area_m2) : null,
      area_norm: saved.area_norm != null ? Number(saved.area_norm) : null,
      perimeter_m: saved.perimeter_m != null ? Number(saved.perimeter_m) : null,
      perimeter_norm: null,
      metres_per_norm_unit: mpu,
      analysis_status: "ok",
      sort_order: rooms.length,
      analysis: saved.analysis || null
    });
    roomsLoadEpoch += 1;
    await loadRooms({ preserveOrder: true });
    discovery.index += 1;
    showDiscoveryCandidate();
    if (discovery && discovery.index < discovery.candidates.length) {
      const vgBit = vgVr.vg_nr != null && vgVr.vr_nr ? ` \xB7 VG ${vgVr.vg_nr} \xB7 VR ${vgVr.vr_nr}` : " \xB7 nog geen VG/VR";
      setStatus(
        `Opgeslagen ${label}${vgBit} \u2014 volgende kandidaat (${discovery.index + 1} van ${discovery.candidates.length})`,
        "ok"
      );
    }
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  } finally {
    discoveryAcceptBtn.disabled = false;
  }
}
function skipDiscovery() {
  if (!discovery) return;
  discovery.index += 1;
  showDiscoveryCandidate();
}
function removeVertexFromActiveOutline(index) {
  if (discovery?.current) {
    const next = removeRingVertex(discovery.current, index);
    if (!next) {
      setStatus("Minstens 3 ankers nodig", "err");
      return false;
    }
    discovery.current = next;
    discovery.candidates[discovery.index] = next;
    discovery.dragVertex = null;
    updateMeasureReadouts();
    drawOverlay();
    setStatus(`Anker verwijderd (${ringVertexCount(next)} over)`, "ok");
    return true;
  }
  if (pendingRoom?.closed) {
    const next = removeRingVertex(pendingRoom.points, index);
    if (!next) {
      setStatus("Minstens 3 ankers nodig", "err");
      return false;
    }
    pendingRoom.points = next;
    pendingRoom.dragVertex = null;
    syncPendingRoomButtons();
    updateMeasureReadouts();
    scheduleRoomListRefresh();
    drawOverlay();
    setStatus(`Anker verwijderd (${ringVertexCount(next)} over)`, "ok");
    return true;
  }
  return false;
}
function insertVertexOnActiveOutline(norm) {
  const maxPx = polylineHitRadiusPx2();
  if (discovery?.current) {
    const edge = hitPolylineEdge(norm, discovery.current, maxPx, canvasWidth, canvasHeight);
    if (!edge) return false;
    const next = insertRingVertex(discovery.current, edge.segmentIndex, edge.point);
    if (!next) return false;
    discovery.current = next;
    discovery.candidates[discovery.index] = next;
    discovery.dragVertex = edge.segmentIndex + 1;
    updateMeasureReadouts();
    drawOverlay();
    setStatus(`Anker toegevoegd (${ringVertexCount(next)} totaal) \u2014 sleep naar de juiste plek`, "ok");
    return true;
  }
  if (pendingRoom?.closed) {
    const edge = hitPolylineEdge(norm, pendingRoom.points, maxPx, canvasWidth, canvasHeight);
    if (!edge) return false;
    const next = insertRingVertex(pendingRoom.points, edge.segmentIndex, edge.point);
    if (!next) return false;
    pendingRoom.points = next;
    pendingRoom.dragVertex = edge.segmentIndex + 1;
    pendingRoom.dragBodyLast = null;
    syncPendingRoomButtons();
    updateMeasureReadouts();
    scheduleRoomListRefresh();
    drawOverlay();
    setStatus(`Anker toegevoegd (${ringVertexCount(next)} totaal) \u2014 sleep naar de juiste plek`, "ok");
    return true;
  }
  return false;
}
function simplifyActiveOutline() {
  if (discovery?.current) {
    const before = ringVertexCount(discovery.current);
    const next = simplifyEditableRing(discovery.current);
    const after = ringVertexCount(next);
    discovery.current = next;
    discovery.candidates[discovery.index] = next;
    updateMeasureReadouts();
    drawOverlay();
    setStatus(
      after < before ? `Vereenvoudigd ${before} \u2192 ${after} ankers` : "Omtrek is al eenvoudig",
      "ok"
    );
    return;
  }
  if (pendingRoom?.closed) {
    const before = ringVertexCount(pendingRoom.points);
    const next = simplifyEditableRing(pendingRoom.points);
    const after = ringVertexCount(next);
    pendingRoom.points = next;
    syncPendingRoomButtons();
    updateMeasureReadouts();
    scheduleRoomListRefresh();
    drawOverlay();
    setStatus(
      after < before ? `Vereenvoudigd ${before} \u2192 ${after} ankers` : "Omtrek is al eenvoudig",
      "ok"
    );
  }
}
function nudgeCurrent(dx, dy) {
  if (discovery?.current) {
    discovery.current = translateRingUnclamped(discovery.current, dx, dy);
    discovery.candidates[discovery.index] = closeRing(discovery.current);
    updateMeasureReadouts();
    drawOverlay();
    return;
  }
  if (pendingRoom?.closed) {
    pendingRoom.points = translateRingUnclamped(pendingRoom.points, dx, dy);
    if (pendingRoom.holes?.length) {
      pendingRoom.holes = pendingRoom.holes.map((h) => translateRingUnclamped(h, dx, dy));
    }
    updateMeasureReadouts();
    scheduleRoomListRefresh();
    drawOverlay();
  }
}
function endCalibrate(msg) {
  calibrate = null;
  calibrateMetresWrap.classList.add("hidden");
  updateScaleUi();
  drawOverlay();
  if (msg) setStatus(msg, "ok");
}
function startCalibrate() {
  endDiscovery();
  void endDetail();
  if (measure.tool !== "off") clearMeasure(false);
  if (calibrate) {
    endCalibrate("Kalibratie geannuleerd");
    return;
  }
  calibrate = { points: [] };
  calibrateMetresWrap.classList.add("hidden");
  calibrateHintEl.textContent = "Klik beide uiteinden van een bekende lengte op de plattegrond.";
  calibrateBtn.textContent = "Kalibratie annuleren";
  setStatus("Klik eerste schaalpunt", "busy");
  drawOverlay();
}
function repickCalibrate() {
  if (!calibrate) return;
  calibrate = { points: [] };
  calibrateMetresWrap.classList.add("hidden");
  calibrateHintEl.textContent = "Klik beide uiteinden van een bekende lengte op de plattegrond.";
  setStatus("Klik eerste schaalpunt", "busy");
  drawOverlay();
}
function formatScaleSaveError(err) {
  let raw = err instanceof Error ? err.message : String(err);
  raw = raw.replace(/^ERROR:\s*/i, "").trim();
  const first = raw.split(/\r?\n/)[0] || raw;
  if (/record .* is not assigned/i.test(first) || /metrics recompute failed/i.test(first)) {
    return "Schaal opslaan mislukt: databasefunctie voor herberekening faalde. Vernieuw de pagina of herstart de server.";
  }
  return first.length > 220 ? `${first.slice(0, 217)}\u2026` : first;
}
async function finishCalibrate() {
  if (!activeSection) {
    setStatus("Geen plattegrond actief \u2014 open eerst een sectie", "err");
    return;
  }
  if (!calibrate || calibrate.points.length < 2) {
    setStatus("Markeer eerst twee schaalpunten op de tekening", "err");
    return;
  }
  const mm = Number(calibrateMetresInput.value);
  if (!(mm > 0)) {
    setStatus("Voer een positieve lengte in millimeters in", "err");
    return;
  }
  const a = calibrate.points[0];
  const b = calibrate.points[1];
  const aspect = activeScaleAspect();
  const mpu = metresPerNormFromCalibration(mm / 1e3, a, b, aspect);
  if (!(mpu > 0) || !Number.isFinite(mpu)) {
    setStatus("Kalibratiepunten te dicht bij elkaar", "err");
    return;
  }
  const hadScale = activeSection.metres_per_norm_unit != null && Number(activeSection.metres_per_norm_unit) > 0;
  const nComp = rooms.length;
  if (hadScale || nComp > 0) {
    const ok = window.confirm(
      `Nieuwe schaal toepassen en alle maten op deze tekening herberekenen?

\u2022 ${nComp} component(en) / ruimte(n) krijgen nieuwe m\xB2 of m
\u2022 Kierlengtes worden bijgewerkt
\u2022 Opgeslagen GA-resultaten voor geraakte VR\u2019s worden gewist (daarna opnieuw Herberekenen)

Contouren en materialen blijven behouden.`
    );
    if (!ok) {
      setStatus("Schaalwijziging geannuleerd", "err");
      return;
    }
  }
  try {
    setStatus("Schaal opslaan en maten herberekenen\u2026", "busy");
    const stats = await persistSectionScale({
      section_id: activeSection.id,
      metres_per_norm_unit: mpu,
      scale_ratio: null,
      scale_source: "CALIBRATED",
      scale_aspect_yx: aspect
    });
    activeSection.metres_per_norm_unit = mpu;
    activeSection.scale_aspect_yx = aspect;
    activeSection.scale_source = "CALIBRATED";
    const idx = sections.findIndex((s) => s.id === activeSection.id);
    if (idx >= 0) sections[idx] = activeSection;
    localRoomPatches.clear();
    applyScaleToInMemoryRooms(mpu);
    const msg = formatScaleRecomputeMsg(stats, `lijn = ${mm} mm`);
    endCalibrate(msg);
    updateMeasureReadouts();
    updateToolHint();
    renderRoomList();
    await loadRooms();
    renderRoomList();
    setStatus(msg, "ok");
  } catch (err) {
    const msg = formatScaleSaveError(err);
    setStatus(msg, "err");
    scaleStatusEl.textContent = "Opslaan mislukt \u2014 schaal niet gezet";
    setCalibrateLed(false);
  }
}
function applyScaleToInMemoryRooms(mpu) {
  const aspect = activeScaleAspect();
  for (const r of rooms) {
    r.metres_per_norm_unit = mpu;
    if (!r.points?.length) continue;
    try {
      if (componentIsLengthQuantity(r)) {
        const len = scaledPathLength(r.points, mpu, aspect, true);
        r.perimeter_m = Math.round(len * 100) / 100;
        r.area_m2 = null;
        if (r.analysis) {
          r.analysis = { ...r.analysis, length_m: r.perimeter_m };
        }
        continue;
      }
      const holes = Array.isArray(r.analysis?.holes) ? r.analysis.holes : [];
      const holesSum = holes.filter((h) => Array.isArray(h) && h.length >= 3).reduce((s, h) => s + shoelaceArea(h), 0);
      const areaNorm = Math.max(0, shoelaceArea(r.points) - holesSum);
      r.area_norm = areaNorm;
      r.area_m2 = Math.round(scaledAreaM2(areaNorm, mpu, aspect) * 100) / 100;
      r.perimeter_m = Math.round(scaledPathLength(r.points, mpu, aspect, true) * 100) / 100;
    } catch {
    }
  }
}
function deleteTargetIds() {
  if (!isFloormapKind() && selectedSetIds.size > 0) {
    return rooms.filter((r) => selectedSetIds.has(r.id)).map((r) => r.id);
  }
  if (pendingRoom?.editingId) return [pendingRoom.editingId];
  return [];
}
function deleteConfirmKey(ids) {
  return ids.slice().sort().join("\n");
}
function deleteConfirmLabel(ids) {
  const names = ids.map((id) => rooms.find((r) => r.id === id)?.label || "component");
  if (names.length === 1) return `\xAB${names[0]}\xBB`;
  const shown = names.slice(0, 4).join(", ");
  const extra = names.length > 4 ? ` +${names.length - 4}` : "";
  return `${names.length} componenten (${shown}${extra})`;
}
function clearPendingDeleteConfirm() {
  pendingDeleteId = null;
  if (pendingDeleteTimer != null) {
    window.clearTimeout(pendingDeleteTimer);
    pendingDeleteTimer = null;
  }
}
async function deleteRooms(ids) {
  if (!ids.length) {
    setStatus("Vink componenten aan of open er \xE9\xE9n om te verwijderen", "err");
    return;
  }
  const key = deleteConfirmKey(ids);
  const uniqueComposed = ids.length === 1 && rooms.some((r) => r.id === ids[0] && isComposeResultRoom(r));
  if (pendingDeleteId !== key) {
    clearPendingDeleteConfirm();
    pendingDeleteId = key;
    pendingDeleteTimer = window.setTimeout(() => {
      pendingDeleteId = null;
      pendingDeleteTimer = null;
      renderRoomList();
      syncPendingRoomButtons();
    }, 8e3);
    renderRoomList();
    syncPendingRoomButtons();
    setStatus(
      uniqueComposed ? `Bevestig wissen van ${deleteConfirmLabel(ids)} (bronnen blijven behouden) \u2014 klik nogmaals op Bevestig wissen` : `Bevestig wissen van ${deleteConfirmLabel(ids)} \u2014 klik nogmaals op Bevestig wissen`,
      "busy"
    );
    return;
  }
  clearPendingDeleteConfirm();
  syncPendingRoomButtons();
  const failed = [];
  try {
    setStatus(
      ids.length === 1 ? `Verwijderen: ${deleteConfirmLabel(ids)}\u2026` : `Verwijderen: ${ids.length} componenten\u2026`,
      "busy"
    );
    const snapshots = ids.map((id) => rooms.find((r) => r.id === id)).filter((r) => Boolean(r));
    for (const id of ids) {
      rooms = rooms.filter((r) => r.id !== id);
      noteLocalRoomDeletion(id);
      if (pendingRoom?.editingId === id) clearPendingRoom();
      if (touchedRoomIds.delete(id)) persistTouchedRoomIds();
      selectedSetIds.delete(id);
      constituentSigns.delete(id);
    }
    roomsLoadEpoch += 1;
    renderRoomList();
    drawOverlay();
    for (const id of ids) {
      const label = snapshots.find((r) => r.id === id)?.label || id;
      try {
        await deleteDrawingSubsection(id);
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err);
        const msg = /restrict|foreign key|verblijfsruimte/i.test(raw) ? `\xAB${label}\xBB is nog gekoppeld aan een verblijfsruimte of andere data` : `\xAB${label}\xBB: ${raw}`;
        failed.push(msg);
        const snap = snapshots.find((r) => r.id === id);
        if (snap) {
          localRoomDeletions.delete(normRoomId(id));
          if (!rooms.some((r) => r.id === snap.id)) rooms = [...rooms, snap];
        }
      }
    }
    rooms = dropLocallyDeletedRooms(rooms);
    renderRoomList();
    drawOverlay();
    if (!failed.length) {
      localRoomPatches.clear();
    }
    await loadRooms();
    if (failed.length) {
      setStatus(
        failed.length === ids.length ? `Verwijderen mislukt. ${failed[0]}` : `${ids.length - failed.length} verwijderd, ${failed.length} mislukt. ${failed[0]}`,
        "err"
      );
      return;
    }
    setStatus(
      uniqueComposed ? `Samengesteld component verwijderd (bronnen blijven behouden)` : ids.length > 1 ? `${ids.length} componenten verwijderd` : "Component verwijderd",
      "ok"
    );
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    setStatus(raw, "err");
    renderRoomList();
  }
}
async function deleteRoom(id) {
  await deleteRooms([id]);
}
async function deletePendingRoom() {
  const ids = deleteTargetIds();
  if (!ids.length) {
    setStatus("Vink componenten aan (checkbox) of open er \xE9\xE9n om te verwijderen", "err");
    return;
  }
  await deleteRooms(ids);
}
async function moveRoom(roomId, delta) {
  if (!auth()?.token || !activeSection) return;
  syncPendingLabelToRooms();
  const index = rooms.findIndex((r) => r.id === roomId);
  const j = index + delta;
  if (index < 0 || j < 0 || index >= rooms.length || j >= rooms.length) return;
  const prevOrder = rooms.map((r) => ({ room: r, sort_order: r.sort_order }));
  const next = rooms.slice();
  const tmp = next[index];
  if (!tmp || !next[j]) return;
  next[index] = next[j];
  next[j] = tmp;
  next.forEach((r, i) => {
    r.sort_order = i;
  });
  rooms = next;
  try {
    renderRoomList();
    drawOverlay();
  } catch (err) {
    console.warn("moveRoom: local render failed", err);
  }
  try {
    const allIds = await allSubsectionIdsForSection(activeSection.id);
    const orderedIds = mergeReorderIds(
      rooms.map((r) => r.id),
      allIds
    );
    if (orderedIds.length !== allIds.length) {
      throw new Error(
        `Volgorde opslaan mislukt: lijst out of sync (${orderedIds.length}/${allIds.length} componenten) \u2014 herlaad de sectie`
      );
    }
    await reorderDrawingSubsections(activeSection.id, orderedIds);
    setStatus("Volgorde opgeslagen", "ok");
  } catch (err) {
    rooms = prevOrder.map((p) => {
      p.room.sort_order = p.sort_order;
      return p.room;
    });
    try {
      renderRoomList();
      drawOverlay();
    } catch {
    }
    setStatus(err instanceof Error ? err.message : String(err), "err");
    try {
      await loadRooms();
    } catch {
    }
  }
}
function hitVertex2(norm, points, pxRadius = 8) {
  return hitVertex(norm, points, canvasWidth, canvasHeight, pxRadius);
}
function vertexHitRadiusPx2() {
  return vertexHitRadiusPx(Boolean(detail));
}
function vertexHandleRadiusPx2() {
  return vertexHandleRadiusPx(Boolean(detail));
}
function canClosePolygonAtCursor2(norm, points) {
  return canClosePolygonAtCursor(norm, points, canvasWidth, canvasHeight, Boolean(detail));
}
function pendingDrawCanClose() {
  return Boolean(
    pendingRoom?.drawing && !pendingRoom.closed && pendingRoom.points.length >= 3 && pendingRoom.drawCursor && canClosePolygonAtCursor2(pendingRoom.drawCursor, pendingRoom.points)
  );
}
function effectivePendingDrawCursor(norm) {
  if (!pendingRoom?.drawing || pendingRoom.closed) return norm;
  if (canClosePolygonAtCursor2(norm, pendingRoom.points)) {
    return { ...pendingRoom.points[0] };
  }
  return norm;
}
function drawCanvasCrosshair(ctx, x, y, size, color, lineWidth = 1.5) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(x - size, y);
  ctx.lineTo(x + size, y);
  ctx.moveTo(x, y - size);
  ctx.lineTo(x, y + size);
  ctx.stroke();
  ctx.restore();
}
function drawOpenPolygonDraft(ctx, room) {
  const pts = room.points;
  if (!pts.length) return;
  const canClose = pts.length >= 3;
  const snap = canClose && room.drawCursor != null && canClosePolygonAtCursor2(room.drawCursor, pts);
  const cursorNorm = room.drawCursor ? snap ? pts[0] : room.drawCursor : null;
  const firstC = normToCanvas2(pts[0]);
  const lastC = normToCanvas2(pts[pts.length - 1]);
  const cursorC = cursorNorm ? normToCanvas2(cursorNorm) : null;
  const hr = vertexHandleRadiusPx2();
  if (cursorC) {
    ctx.strokeStyle = snap ? "#1b5e20" : "#43a047";
    ctx.lineWidth = snap ? 2.5 : 1.5;
    ctx.setLineDash(snap ? [5, 3] : [6, 4]);
    ctx.beginPath();
    ctx.moveTo(lastC.x, lastC.y);
    ctx.lineTo(cursorC.x, cursorC.y);
    if (snap) ctx.lineTo(firstC.x, firstC.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  for (let i = 0; i < pts.length; i++) {
    const c = normToCanvas2(pts[i]);
    const isFirst = i === 0;
    const r = isFirst ? snap ? hr * 2.4 : canClose ? hr * 1.75 : hr * 1.25 : hr;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    if (isFirst) {
      ctx.fillStyle = snap ? "rgba(27,94,32,0.42)" : canClose ? "rgba(46,125,50,0.22)" : "rgba(255,255,255,0.35)";
      ctx.strokeStyle = snap ? "#1b5e20" : canClose ? "#2e7d32" : "#00bcd4";
      ctx.lineWidth = snap ? 2.5 : 2;
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.strokeStyle = "#00bcd4";
      ctx.lineWidth = detail ? 1.5 : 1;
    }
    ctx.fill();
    ctx.stroke();
    if (isFirst) {
      drawCanvasCrosshair(ctx, c.x, c.y, snap ? 11 : canClose ? 8 : 5, isFirst && snap ? "#1b5e20" : "#2e7d32", snap ? 2 : 1.25);
      if (snap) {
        ctx.fillStyle = "#1b5e20";
        ctx.font = "600 11px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Sluiten", c.x, c.y - r - 7);
      } else if (canClose) {
        ctx.fillStyle = "#2e7d32";
        ctx.font = "500 10px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("start", c.x, c.y - r - 6);
      }
    }
  }
  if (cursorC && !snap) {
    drawCanvasCrosshair(ctx, cursorC.x, cursorC.y, 7, "#43a047", 1.25);
  }
}
function polylineHitRadiusPx2() {
  return polylineHitRadiusPx(Boolean(detail));
}
function hitNearPolyline2(norm, points, maxPx) {
  return hitNearPolyline(norm, points, maxPx, canvasWidth, canvasHeight);
}
function pointInRing3(pt, points) {
  return pointInRing2(pt, points);
}
overlayCanvas.addEventListener("mousedown", (ev) => {
  const c = eventToCanvas2(ev);
  const norm = canvasToNorm2(c.x, c.y);
  if (detailPick) {
    detailPick.armed = false;
    detailPick.start = { ...norm };
    detailPick.current = { ...norm };
    drawOverlay();
    return;
  }
  if (calibrate) {
    if (calibrate.points.length >= 2) return;
    calibrate.points.push(norm);
    drawOverlay();
    if (calibrate.points.length === 1) {
      setStatus("Klik tweede schaalpunt", "busy");
      calibrateHintEl.textContent = "Klik het andere uiteinde van de bekende lengte.";
    } else if (calibrate.points.length >= 2) {
      calibrateMetresWrap.classList.remove("hidden");
      calibrateHintEl.textContent = "Voer de werkelijke lengte in millimeters in, daarna Toepassen (of druk Enter).";
      setStatus("Voer lengte in mm in, daarna Toepassen", "ok");
      queueMicrotask(() => {
        calibrateMetresInput.focus();
        calibrateMetresInput.select();
      });
    }
    return;
  }
  if (pendingRoom?.drawing && !pendingRoom.closed) {
    if (pendingRoom.points.length >= 3 && (canClosePolygonAtCursor2(norm, pendingRoom.points) || ev.detail === 2)) {
      closePendingPolygon();
      return;
    }
    pendingRoom.drawCursor = null;
    pendingRoom.points.push(norm);
    syncPendingRoomButtons();
    updateMeasureReadouts();
    updateToolHint();
    drawOverlay();
    return;
  }
  if (pendingRoom && !pendingRoom.drawing) {
    const vertexHitPx = vertexHitRadiusPx2();
    const vi = hitVertex2(norm, pendingRoom.points, vertexHitPx);
    if (vi >= 0) {
      ev.preventDefault();
      if (ev.detail === 2 && pendingRoom.closed) {
        removeVertexFromActiveOutline(vi);
        return;
      }
      pendingRoom.dragVertex = vi;
      pendingRoom.dragBodyLast = null;
      overlayCanvas.style.cursor = "grabbing";
      return;
    }
    if (ev.detail === 2 && pendingRoom.closed && insertVertexOnActiveOutline(norm)) {
      ev.preventDefault();
      return;
    }
    const nearLine = hitNearPolyline2(norm, pendingRoom.points, polylineHitRadiusPx2());
    const inside = pendingRoom.closed && pointInRing3(norm, pendingRoom.points);
    if (nearLine || inside) {
      ev.preventDefault();
      pendingRoom.dragBodyLast = canvasToNormUnclamped2(c.x, c.y);
      pendingRoom.dragVertex = null;
      overlayCanvas.style.cursor = "grabbing";
      return;
    }
  }
  if (measure.tool === "length") {
    if (!activeScaleMpu()) {
      setStatus("Zet eerst de schaal", "err");
      return;
    }
    if (measure.points.length >= 2) {
      measure.points = [norm];
    } else {
      measure.points.push(norm);
    }
    updateMeasureReadouts();
    updateToolHint();
    drawOverlay();
    return;
  }
  if (discovery) {
    const vi = hitVertex2(norm, discovery.current, 12);
    if (vi >= 0) {
      if (ev.detail === 2) {
        removeVertexFromActiveOutline(vi);
        return;
      }
      discovery.dragVertex = vi;
      return;
    }
    if (ev.detail === 2 && insertVertexOnActiveOutline(norm)) {
      ev.preventDefault();
      return;
    }
  }
});
overlayCanvas.addEventListener("dblclick", (ev) => {
  ev.preventDefault();
});
overlayCanvas.addEventListener("mousemove", (ev) => {
  const c = eventToCanvas2(ev);
  const norm = canvasToNorm2(c.x, c.y);
  if (detailPick && !detailPick.armed) {
    detailPick.current = { ...norm };
    drawOverlay();
    return;
  }
  if (pendingRoom?.dragVertex != null || pendingRoom?.dragBodyLast) return;
  if (pendingRoom?.drawing && !pendingRoom.closed) {
    pendingRoom.drawCursor = effectivePendingDrawCursor(norm);
    overlayCanvas.style.cursor = pendingDrawCanClose() ? "pointer" : "crosshair";
    updateMeasureReadouts();
    drawOverlay();
    return;
  }
  if (pendingRoom?.closed) {
    const onVertex = hitVertex2(norm, pendingRoom.points, vertexHitRadiusPx2()) >= 0;
    const inside = pointInRing3(norm, pendingRoom.points);
    overlayCanvas.style.cursor = onVertex || inside ? "grab" : "";
  }
  if (measure.tool === "length" && measure.points.length < 2) {
    measure.cursor = norm;
    updateMeasureReadouts();
    drawOverlay();
    return;
  }
  if (discovery?.dragVertex != null) return;
});
overlayCanvas.addEventListener("mouseup", () => {
  if (detailPick && !detailPick.armed) {
    const rect = normalizeNormRect(detailPick.start, detailPick.current);
    const keepFactor = detail?.factor ?? DETAIL_FACTOR_DEFAULT;
    void commitDetailRect(rect, keepFactor);
    return;
  }
  if (discovery) {
    if (discovery.dragVertex != null) {
      discovery.candidates[discovery.index] = closeRing(discovery.current);
      discovery.dragVertex = null;
      updateMeasureReadouts();
      drawOverlay();
    }
    return;
  }
  if (pendingRoom?.dragVertex != null || pendingRoom?.dragBodyLast) {
    pendingRoom.dragVertex = null;
    pendingRoom.dragBodyLast = null;
    overlayCanvas.style.cursor = "grab";
    updateMeasureReadouts();
    scheduleRoomListRefresh();
    drawOverlay();
  }
});
overlayCanvas.addEventListener("mouseleave", () => {
  if (detailPick && !detailPick.armed) {
    detailPick.armed = true;
    drawOverlay();
    setStatus("Detailgebied: sleep opnieuw een rechthoek", "busy");
    return;
  }
  if (pendingRoom?.dragVertex == null && !pendingRoom?.dragBodyLast && discovery?.dragVertex == null) {
    if (pendingRoom?.drawing && !pendingRoom.closed) {
      pendingRoom.drawCursor = null;
      drawOverlay();
    }
    overlayCanvas.style.cursor = "";
  }
});
window.addEventListener("mouseup", () => {
  if (pendingRoom?.dragVertex != null || pendingRoom?.dragBodyLast) {
    pendingRoom.dragVertex = null;
    pendingRoom.dragBodyLast = null;
    overlayCanvas.style.cursor = pendingRoom.closed ? "grab" : "";
    updateMeasureReadouts();
    scheduleRoomListRefresh();
    drawOverlay();
  }
  if (discovery?.dragVertex != null) {
    discovery.candidates[discovery.index] = closeRing(discovery.current);
    discovery.dragVertex = null;
    updateMeasureReadouts();
    drawOverlay();
  }
});
window.addEventListener("mousemove", (ev) => {
  if (pendingRoom?.dragVertex == null && !pendingRoom?.dragBodyLast && discovery?.dragVertex == null) {
    return;
  }
  if (!overlayCanvas.isConnected) return;
  const c = eventToCanvas2(ev);
  const norm = canvasToNormUnclamped2(c.x, c.y);
  if (pendingRoom?.dragVertex != null) {
    const i = pendingRoom.dragVertex;
    pendingRoom.points[i] = { x: norm.x, y: norm.y };
    if (i === 0 && pendingRoom.closed) {
      pendingRoom.points[pendingRoom.points.length - 1] = { ...norm };
    }
    updateMeasureReadouts();
    scheduleRoomListRefresh();
    drawOverlay();
    return;
  }
  if (pendingRoom?.dragBodyLast) {
    const dx = norm.x - pendingRoom.dragBodyLast.x;
    const dy = norm.y - pendingRoom.dragBodyLast.y;
    if (Math.hypot(dx, dy) > 1e-9) {
      if (pendingRoom.closed) {
        pendingRoom.points = translateRingUnclamped(pendingRoom.points, dx, dy);
        if (pendingRoom.holes?.length && !pendingIsLengthComponent()) {
          pendingRoom.holes = pendingRoom.holes.map((h) => translateRingUnclamped(h, dx, dy));
        }
      } else {
        pendingRoom.points = pendingRoom.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
      }
      pendingRoom.dragBodyLast = { ...norm };
      updateMeasureReadouts();
      scheduleRoomListRefresh();
      drawOverlay();
    }
    return;
  }
  if (discovery?.dragVertex != null) {
    const i = discovery.dragVertex;
    discovery.current[i] = norm;
    if (i === 0) discovery.current[discovery.current.length - 1] = { ...norm };
    discovery.candidates[discovery.index] = closeRing(discovery.current);
    updateMeasureReadouts();
    drawOverlay();
  }
});
loginForm.addEventListener("submit", (ev) => {
  ev.preventDefault();
  const fd = new FormData(loginForm);
  const username = String(fd.get("username") || "");
  const password = String(fd.get("password") || "");
  void (async () => {
    try {
      setStatus("Inloggen\u2026", "busy");
      await session.bootstrapAndLogin(username, password);
      setStatus("Ingelogd", "ok");
      if (buildingId) await loadFloormapSections(buildingId);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err), "err");
      showLogin();
    }
  })();
});
logoutBtn.addEventListener("click", () => {
  session.logout();
  setStatus("Uitgelogd", "ok");
});
loadBuildingBtn.addEventListener("click", () => {
  void loadFloormapSections(buildingInput.value);
});
setApplyBtn?.addEventListener("click", () => {
  void applyBooleanSet();
});
setClearSelBtn?.addEventListener("click", () => {
  selectedSetIds.clear();
  constituentSigns.clear();
  booleanPreview = null;
  setComposeFeedback("", "clear");
  renderComposeParts();
  renderRoomList();
  drawOverlay();
  setStatus("Selectie gewist", "ok");
});
roomVrFilterEl?.addEventListener("change", () => {
  roomListVrFilter = roomVrFilterEl.value;
  if (!isFloormapKind() && roomListVrFilter) {
    roomVrInput.value = roomListVrFilter;
    const vg = buildingVrToVg.get(roomListVrFilter);
    if (vg != null) roomVgInput.value = String(vg);
  }
  renderRoomList();
  drawOverlay();
});
materialCategoryEl?.addEventListener("change", () => {
  if (materialFilterEl) materialFilterEl.value = "";
  renderMaterialSubcategoryOptions();
  void loadMaterialsForCategory((materialCategoryEl.value || "").trim());
  syncPendingRoomButtons();
  updateMaterialQuantityHint();
  updateMaterialSpectrumPreview(null);
});
materialSubcategoryEl?.addEventListener("change", () => {
  void loadMaterialsForCategory((materialCategoryEl?.value || "").trim(), (materialFilterEl?.value || "").trim());
});
materialFilterEl?.addEventListener("input", () => {
  scheduleMaterialFilterReload();
});
materialFavoriteEl?.addEventListener("change", () => {
  const id = (materialFavoriteEl.value || "").trim();
  if (!id) {
    syncFavoriteButtons();
    return;
  }
  void selectMaterialById(id, true).catch(
    (err) => setStatus(err instanceof Error ? err.message : String(err), "err")
  );
});
favoriteAddBtn?.addEventListener("click", () => {
  const id = (materialIdEl?.value || "").trim();
  if (!id) return;
  void addMaterialFavorite(id).catch(
    (err) => setStatus(err instanceof Error ? err.message : String(err), "err")
  );
});
favoriteRemoveBtn?.addEventListener("click", () => {
  const id = (materialIdEl?.value || materialFavoriteEl?.value || "").trim();
  if (!id) return;
  void removeMaterialFavorite(id).catch(
    (err) => setStatus(err instanceof Error ? err.message : String(err), "err")
  );
});
presetSaveBtn?.addEventListener("click", () => {
  if (!buildingId || !auth()?.token) return;
  const name = window.prompt("Naam voor deze favorieten-preset:");
  if (!name?.trim()) return;
  const run = bppPhase1Enabled() ? bppMaterialFavoritePresetAction(invokeString, auth().token, {
    action: "save",
    name: name.trim(),
    building_id: buildingId
  }) : apiPost("/api/floormap/material-favorite-presets", {
    action: "save",
    name: name.trim(),
    building_id: buildingId
  });
  void run.then((data) => {
    setStatus(`Preset opgeslagen (${data.material_count ?? "?"} materialen)`, "ok");
  }).catch((err) => setStatus(err instanceof Error ? err.message : String(err), "err"));
});
presetApplyBtn?.addEventListener("click", () => {
  if (!buildingId || !auth()?.token) return;
  void (async () => {
    const data = bppPhase1Enabled() ? await bppListMaterialFavoritePresets(invokeString, auth().token) : await apiGet("/api/floormap/material-favorite-presets");
    const presets = data.presets || [];
    if (!presets.length) {
      setStatus("Geen presets beschikbaar", "err");
      return;
    }
    const lines = presets.map((p, i) => `${i + 1}. ${p.name} (${p.material_count})`).join("\n");
    const pick = window.prompt(`Kies preset-nummer:
${lines}`);
    const idx = Number(pick) - 1;
    if (!Number.isInteger(idx) || idx < 0 || idx >= presets.length) return;
    const preset = presets[idx];
    if (!window.confirm(
      `Favorieten van dit project vervangen door \xAB${preset.name}\xBB (${preset.material_count} materialen)?`
    )) {
      return;
    }
    if (bppPhase1Enabled()) {
      await bppMaterialFavoritePresetAction(invokeString, auth().token, {
        action: "apply",
        preset_id: preset.preset_id,
        building_id: buildingId
      });
    } else {
      await apiPost("/api/floormap/material-favorite-presets", {
        action: "apply",
        preset_id: preset.preset_id,
        building_id: buildingId
      });
    }
    await loadFavoriteMaterials();
    setStatus(`Preset \xAB${preset.name}\xBB toegepast`, "ok");
  })().catch((err) => setStatus(err instanceof Error ? err.message : String(err), "err"));
});
materialIdEl?.addEventListener("change", () => {
  syncPendingRoomButtons();
  updateMaterialQuantityHint();
  updateMaterialSpectrumPreview();
  updateReplaceMaterialBtn();
  if (materialFavoriteEl && materialIdEl.value) {
    if (favoriteMaterials.some((m) => m.material_id === materialIdEl.value)) {
      materialFavoriteEl.value = materialIdEl.value;
    } else {
      materialFavoriteEl.value = "";
    }
  }
  syncFavoriteButtons();
});
replaceMatCb?.addEventListener("change", () => {
  syncReplaceMaterialUi();
});
replaceMatFromEl?.addEventListener("change", () => {
  void ensureReplaceToCatalogForFrom();
});
replaceMatToEl?.addEventListener("change", () => {
  updateReplaceMaterialBtn();
});
replaceMatBtn?.addEventListener("click", () => {
  void replaceMaterialInProject();
});
function openMaterialCatalogEditor(opts) {
  const matUrl = new URL("/materials.html", location.origin);
  if (opts?.newMaterial) {
    matUrl.searchParams.set("new", "1");
  } else {
    const mat = selectedCatalogMaterial();
    if (mat?.material_id) matUrl.searchParams.set("material_id", mat.material_id);
    if (mat?.catalog_id) matUrl.searchParams.set("q", mat.catalog_id);
  }
  if (buildingId) matUrl.searchParams.set("building_id", buildingId);
  stashComponentDraftForCatalog();
  matUrl.searchParams.set("return", componentReturnPath());
  matUrl.searchParams.set("return_label", "Terug naar gevelcomponent");
  location.assign(matUrl.toString());
}
function componentReturnPath() {
  const u = new URL("/floormap.html", location.origin);
  if (buildingId) u.searchParams.set("building_id", buildingId);
  if (activeSection?.id) u.searchParams.set("section_id", activeSection.id);
  u.searchParams.set("from_catalog", "1");
  return `${u.pathname}${u.search}`;
}
function stashComponentDraftForCatalog() {
  if (!activeSection || !buildingId) return;
  const sidebarWidthPx = getEngineerSidebarWidthPx() ?? void 0;
  const draft = {
    v: 1,
    buildingId,
    sectionId: activeSection.id,
    pending: pendingRoom ? {
      points: pendingRoom.points.map((p) => ({ ...p })),
      holes: (pendingRoom.holes || []).map((ring) => ring.map((p) => ({ ...p }))),
      closed: pendingRoom.closed,
      editingId: pendingRoom.editingId,
      drawing: pendingRoom.drawing
    } : null,
    label: (roomLabelInput?.value || "").trim(),
    vg: (roomVgInput?.value || "").trim(),
    vr: (roomVrInput?.value || "").trim(),
    level: (roomLevelSelect?.value || "").trim() || "OTHER",
    viewZoom,
    scrollLeft: pdfScrollEl?.scrollLeft ?? 0,
    scrollTop: pdfScrollEl?.scrollTop ?? 0,
    sidebarWidthPx
  };
  try {
    sessionStorage.setItem(COMPONENT_DRAFT_KEY, JSON.stringify(draft));
  } catch {
  }
}
function readSessionJson(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function coerceDraftPoints(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const p of raw) {
    if (!p || typeof p !== "object") continue;
    const x = Number(p.x);
    const y = Number(p.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    out.push({ x, y });
  }
  return out;
}
function coerceDraftHoles(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((ring) => coerceDraftPoints(ring)).filter((ring) => ring.length >= 3);
}
function idsMatch(a, b) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
async function restoreAfterCatalogReturn() {
  if (!activeSection || !buildingId) return;
  const urlParams = new URLSearchParams(location.search);
  const fromCatalog = urlParams.get("from_catalog") === "1";
  const pick = readSessionJson(MATERIAL_PICK_KEY);
  if (!fromCatalog && !pick) return;
  if (fromCatalog) {
    urlParams.delete("from_catalog");
    const qs = urlParams.toString();
    history.replaceState({}, "", `${location.pathname}${qs ? `?${qs}` : ""}${location.hash}`);
  }
  const storedDraft = readSessionJson(COMPONENT_DRAFT_KEY);
  if (storedDraft) sessionStorage.removeItem(COMPONENT_DRAFT_KEY);
  if (pick) sessionStorage.removeItem(MATERIAL_PICK_KEY);
  const draft = (pick?.draft && pick.draft.v === 1 ? pick.draft : null) || storedDraft;
  const draftOk = Boolean(draft) && draft.v === 1 && idsMatch(draft.sectionId, activeSection.id) && (!draft.buildingId || idsMatch(draft.buildingId, buildingId));
  if (draftOk && draft?.pending) {
    const points = coerceDraftPoints(draft.pending.points);
    if (points.length > 0) {
      const holes = coerceDraftHoles(draft.pending.holes);
      const keepOpen = Boolean(draft.pending.drawing) && !draft.pending.closed && points.length < 3;
      const closed = !keepOpen && (Boolean(draft.pending.closed) || points.length >= 3);
      pendingRoom = {
        points: closed ? closeRing(points) : points,
        holes: closed ? holes : [],
        closed,
        editingId: draft.pending.editingId || null,
        dragVertex: null,
        dragBodyLast: null,
        drawing: !closed && Boolean(draft.pending.drawing),
        drawCursor: null,
        label: (draft.label || "").trim()
      };
      if (roomLabelInput) roomLabelInput.value = draft.label || "";
      if (roomVgInput) roomVgInput.value = draft.vg || "";
      if (roomVrInput) roomVrInput.value = draft.vr || "";
      if (roomLevelSelect) roomLevelSelect.value = draft.level || "OTHER";
      syncToolButtons();
      updateMeasureReadouts();
      updateToolHint();
      renderRoomList();
      drawOverlay();
    }
  } else if (draftOk && draft) {
    if (roomLabelInput && draft.label) roomLabelInput.value = draft.label;
    if (roomVgInput && draft.vg) roomVgInput.value = draft.vg;
    if (roomVrInput && draft.vr) roomVrInput.value = draft.vr;
    if (roomLevelSelect && draft.level) roomLevelSelect.value = draft.level;
  }
  const pickIsKier = Boolean(
    pick?.master_category && isLengthQuantityRubriek(pick.master_category)
  );
  const wantKierSuggest = Boolean(pickIsKier && pendingRoom?.closed && !isFloormapKind()) || sessionStorage.getItem("app-gevelwering-kier-suggest-new") === "1";
  sessionStorage.removeItem("app-gevelwering-kier-suggest-new");
  if (pick?.material_id && wantKierSuggest && !isFloormapKind()) {
    if (kierSuggestCb) {
      kierSuggestCb.checked = true;
      kierSuggestCb.dataset.userTouched = "1";
    }
    await ensureKierMaterials();
    if (!kierMaterials.some((m) => m.material_id === pick.material_id)) {
      kierMaterials = [
        {
          material_id: pick.material_id,
          catalog_id: pick.catalog_id || "",
          material_no: 0,
          master_category: pick.master_category,
          name: pick.name || pick.material_id,
          category: pick.category || "",
          thickness_mm: null,
          ra_dba: null
        },
        ...kierMaterials
      ];
    }
    renderKierMaterialOptions(pick.material_id);
    syncKierSuggestUi();
    const label = (pick.name || pick.catalog_id || pick.material_id).trim();
    setStatus(`Kierdichting \xAB${label}\xBB gekozen \u2014 sla het vlak op om de omtrek toe te voegen`, "ok");
  } else if (pick?.material_id && pick.master_category && !isFloormapKind()) {
    await applyMaterialSelectionFromAnalysis({
      material_id: pick.material_id,
      master_category: pick.master_category,
      category: pick.category || "",
      material_name: pick.name || "",
      catalog_id: pick.catalog_id || ""
    });
    if (materialIdEl && pick.material_id && materialIdEl.value !== pick.material_id) {
      if (![...materialIdEl.options].some((o) => o.value === pick.material_id)) {
        const opt = document.createElement("option");
        opt.value = pick.material_id;
        opt.textContent = `${pick.catalog_id || pick.material_id} \xB7 ${pick.name || "materiaal"}`;
        materialIdEl.appendChild(opt);
        if (!catalogMaterials.some((m) => m.material_id === pick.material_id)) {
          catalogMaterials.push({
            material_id: pick.material_id,
            catalog_id: pick.catalog_id || "",
            material_no: 0,
            master_category: pick.master_category,
            name: pick.name || pick.material_id,
            category: pick.category || "",
            thickness_mm: null,
            ra_dba: null
          });
        }
      }
      materialIdEl.value = pick.material_id;
      materialIdEl.disabled = false;
      updateMaterialSpectrumPreview();
    }
    const label = (pick.name || pick.catalog_id || pick.material_id).trim();
    setStatus(
      pendingRoom ? `Materiaal \xAB${label}\xBB overgenomen \u2014 sla het component op om te koppelen` : `Materiaal \xAB${label}\xBB geselecteerd voor het component`,
      "ok"
    );
  } else if (draftOk && pendingRoom) {
    setStatus("Componentconcept hersteld na catalogus", "ok");
  }
  if (draftOk && draft) await restoreViewStateFromDraft(draft);
  syncPendingRoomButtons();
}
async function restoreViewStateFromDraft(draft) {
  if (draft.sidebarWidthPx != null && draft.sidebarWidthPx > 0) {
    setEngineerSidebarWidthPx(draft.sidebarWidthPx);
  }
  const z = Number(draft.viewZoom);
  if (Number.isFinite(z) && z > 0) {
    await setViewZoom(z);
  }
  const left = Number(draft.scrollLeft);
  const top = Number(draft.scrollTop);
  const hasScroll = Number.isFinite(left) && left > 0 || Number.isFinite(top) && top > 0;
  if (hasScroll && pdfScrollEl) {
    const applyScroll = () => {
      pdfScrollEl.scrollLeft = Math.max(0, left || 0);
      pdfScrollEl.scrollTop = Math.max(0, top || 0);
    };
    applyScroll();
    requestAnimationFrame(applyScroll);
  } else if (pendingRoom?.points.length) {
    queueMicrotask(() => {
      if (pendingRoom?.points.length) scrollToRing(pendingRoom.points);
    });
  }
}
openMatCatalogBtn?.addEventListener("click", () => {
  openMaterialCatalogEditor();
});
customMatToggleBtn?.addEventListener("click", () => {
  openMaterialCatalogEditor({ newMaterial: true });
});
kierSuggestCb?.addEventListener("change", () => {
  if (!kierSuggestCb) return;
  kierSuggestCb.dataset.userTouched = "1";
  const editingId = pendingRoom?.editingId;
  if (editingId) {
    const room = rooms.find((r) => r.id === editingId);
    if (room && !componentIsLengthQuantity(room)) {
      void toggleKierSealForRoom(room, kierSuggestCb.checked).then(() => {
        syncKierSuggestUi();
      });
      return;
    }
  }
  if (kierSuggestHintEl) {
    const peri = pendingRoom ? perimeterMOfRing(pendingRoom.points) : null;
    const periBit = peri != null ? ` Omtrek \u2248 ${peri.toFixed(2)} m.` : " Zet eerst de schaal voor meters.";
    kierSuggestHintEl.textContent = kierSuggestCb.checked ? `Kierdichting aangevinkt \u2014 wordt bij Opslaan toegevoegd.${periBit}` : `Geen kierdichting bij Opslaan.${periBit}`;
  }
});
kierSuggestNewBtn?.addEventListener("click", () => {
  sessionStorage.setItem("app-gevelwering-kier-suggest-new", "1");
  openMaterialCatalogEditor({ newMaterial: true });
});
function updateMaterialQuantityHint() {
  const hint = materialBlockEl?.querySelector(".hint:last-of-type") || materialBlockEl?.querySelector(".hint");
  if (!(hint instanceof HTMLElement)) return;
  if (selectedIsKierdichting()) {
    hint.textContent = "Rubriek 9 (kierdichting): lengte in meters wordt opgeslagen (pad \u22652 punten of gesloten omtrek). Geen oppervlakte.";
  } else {
    hint.textContent = "Materiaal is optioneel bij opslaan (oranje led). Koppel later voor de berekening; alleen complete componenten (groen) zijn kiesbaar bij vlakdelen.";
  }
}
backPickerBtn.addEventListener("click", () => {
  if (activeSection?.id) captureSectionRoomsSnapshot(activeSection.id);
  resetSectionWorkspace({ preserveLocalRoomState: true });
  activeSection = null;
  clearLastSectionId(buildingId);
  syncFloormapLocation(null);
  updateScaleUi();
  workspacePanelEl.classList.add("hidden");
  pickerPanelEl.classList.remove("hidden");
  renderSectionList();
});
zoomOutBtn.addEventListener("click", () => {
  const stepped = Math.round((viewZoom - ZOOM_STEP) * 10) / 10;
  void setViewZoom(stepped, detail ? ZOOM_MAX_DETAIL : ZOOM_MAX);
});
zoomInBtn.addEventListener("click", () => {
  const stepped = Math.round((viewZoom + ZOOM_STEP) * 10) / 10;
  void setViewZoom(stepped, detail ? ZOOM_MAX_DETAIL : ZOOM_MAX);
});
zoomBtn.addEventListener("click", () => {
  void endDetail();
  void setViewZoom(1, ZOOM_MAX);
});
zoomFitBtn.addEventListener("click", () => {
  void endDetail();
  void zoomToFit();
});
discoverBtn.addEventListener("click", () => void startDiscovery());
discoverBtnSide?.addEventListener("click", () => void startDiscovery());
discoverMinSizeEl?.addEventListener("input", updateDiscoverFilterAria);
updateDiscoverFilterAria();
calibrateBtn.addEventListener("click", () => startCalibrate());
vgVrOverviewBtn?.addEventListener("click", () => {
  void openVgVrOverview();
});
vgVrOverviewCopyBtn?.addEventListener("click", () => {
  void copyVgVrOverviewToClipboard();
});
copyLayoutCb?.addEventListener("change", () => {
  syncCopyLayoutUi();
});
copyLayoutSourceEl?.addEventListener("change", () => {
  if (copyLayoutBtn) {
    copyLayoutBtn.disabled = !(copyLayoutCb?.checked && copyLayoutSourceEl.value);
  }
});
copyLayoutBtn?.addEventListener("click", () => {
  const src = copyLayoutSourceEl?.value || "";
  if (!src) {
    setStatus("Kies eerst een bronplattegrond", "err");
    return;
  }
  void copyLayoutFromSection(src);
});
copyGevelCb?.addEventListener("change", () => {
  syncCopyGevelUi();
});
copyGevelSourceEl?.addEventListener("change", () => {
  if (copyGevelBtn) {
    copyGevelBtn.disabled = !(copyGevelCb?.checked && copyGevelSourceEl.value);
  }
});
copyGevelBtn?.addEventListener("click", () => {
  const src = copyGevelSourceEl?.value || "";
  if (!src) {
    setStatus("Kies eerst een bron VR \xB7 ori", "err");
    return;
  }
  void copyGevelStackFromSource(src);
});
detailBtn?.addEventListener("click", () => startDetailTool());
detailCloseBtn?.addEventListener("click", () => {
  void endDetail("Detailgebied gesloten");
});
detailRepickBtn?.addEventListener("click", () => repickDetail());
document.querySelectorAll(".detail-factor-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!detail) return;
    const f = Number(btn.dataset.factor);
    if (f !== 1 && f !== 2 && f !== 3 && f !== 4) return;
    detail.factor = f;
    void applyDetailView();
  });
});
calibrateApplyBtn.addEventListener("click", () => void finishCalibrate());
calibrateRepickBtn.addEventListener("click", () => repickCalibrate());
calibrateMetresInput.addEventListener("keydown", (evt) => {
  if (evt.key === "Enter") {
    evt.preventDefault();
    void finishCalibrate();
  }
});
roomDrawBtn.addEventListener("click", () => startDrawRoom());
roomCloseBtn.addEventListener("click", () => closePendingPolygon());
roomSimplifyBtn?.addEventListener("click", () => simplifyActiveOutline());
roomSaveBtn.addEventListener("click", () => void savePendingRoom());
roomLabelInput.addEventListener("input", () => {
  syncPendingLabelToRooms();
  scheduleRoomListRefresh();
});
expectedOriRowEl?.addEventListener("change", (ev) => {
  const t = ev.target;
  if (t instanceof HTMLInputElement && t.type === "checkbox") {
    syncOriCorrRows();
  }
});
componentOriEl?.addEventListener("change", () => {
  rememberComponentOrientatie(readComponentOrientatie());
});
roomDuplicateBtn?.addEventListener("click", () => {
  void duplicateFromPending();
});
roomClearBtn.addEventListener("click", () => {
  clearPendingRoom();
  setStatus("Markering gewist", "ok");
});
roomDeleteBtn?.addEventListener("click", () => {
  void deletePendingRoom();
});
document.querySelectorAll(".tool-mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    setMeasureTool(btn.dataset.tool || "off");
  });
});
toolClearBtn?.addEventListener("click", () => {
  if (pendingRoom) {
    clearPendingRoom();
    setStatus("Markering gewist", "ok");
    return;
  }
  clearMeasure(true);
  setStatus("Meting gewist", "ok");
});
(() => {
  const panel = document.getElementById("fm-tools-bar");
  if (!panel) return;
  const key = "app-gevelwering-tools-collapsed";
  panel.open = localStorage.getItem(key) !== "1";
  panel.addEventListener("toggle", () => {
    localStorage.setItem(key, panel.open ? "0" : "1");
  });
})();
(() => {
  const panel = document.getElementById("fm-set-ops-fieldset");
  if (!panel) return;
  const key = "app-gevelwering-compose-collapsed";
  panel.open = localStorage.getItem(key) === "0";
  panel.addEventListener("toggle", () => {
    localStorage.setItem(key, panel.open ? "0" : "1");
  });
})();
window.addEventListener("keydown", (evt) => {
  const tag = evt.target?.tagName;
  const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
  if ((evt.metaKey || evt.ctrlKey) && (evt.key === "d" || evt.key === "D")) {
    if (typing) return;
    if (pendingRoom?.closed) {
      evt.preventDefault();
      void duplicateFromPending(evt.shiftKey ? void 0 : 1);
      return;
    }
  }
  if (!typing && pendingRoom?.closed && !evt.metaKey && !evt.ctrlKey && !evt.altKey) {
    const step = evt.shiftKey ? 0.02 : 0.01;
    if (evt.key === "ArrowLeft") {
      evt.preventDefault();
      nudgeCurrent(-step, 0);
      return;
    }
    if (evt.key === "ArrowRight") {
      evt.preventDefault();
      nudgeCurrent(step, 0);
      return;
    }
    if (evt.key === "ArrowUp") {
      evt.preventDefault();
      nudgeCurrent(0, -step);
      return;
    }
    if (evt.key === "ArrowDown") {
      evt.preventDefault();
      nudgeCurrent(0, step);
      return;
    }
  }
  if (evt.key !== "Escape") return;
  if (detailPick || detail) {
    void endDetail("Detailgebied gesloten");
    return;
  }
  if (pendingRoom) {
    clearPendingRoom();
    setStatus("Markering gewist", "ok");
  } else if (measure.tool !== "off") {
    clearMeasure(true);
    setStatus("Meting gewist", "ok");
  }
});
discoveryAcceptBtn.addEventListener("click", () => void acceptDiscovery());
discoverySkipBtn.addEventListener("click", () => skipDiscovery());
discoveryCancelBtn.addEventListener("click", () => endDiscovery("Ontdekken geannuleerd"));
discoverySimplifyBtn?.addEventListener("click", () => simplifyActiveOutline());
nudgeLeftBtn.addEventListener("click", () => nudgeCurrent(-0.01, 0));
nudgeRightBtn.addEventListener("click", () => nudgeCurrent(0.01, 0));
nudgeUpBtn.addEventListener("click", () => nudgeCurrent(0, -0.01));
nudgeDownBtn.addEventListener("click", () => nudgeCurrent(0, 0.01));
editNudgeLeftBtn?.addEventListener("click", () => nudgeCurrent(-0.01, 0));
editNudgeRightBtn?.addEventListener("click", () => nudgeCurrent(0.01, 0));
editNudgeUpBtn?.addEventListener("click", () => nudgeCurrent(0, -0.01));
editNudgeDownBtn?.addEventListener("click", () => nudgeCurrent(0, 0.01));
syncPendingRoomButtons();
syncFavoriteButtons();
buildingInput.value = buildingId;
initPasswordToggles();
initEngineerLayoutSplit();
if (fileMenuRoot) {
  projectMenu = mountProjectMenu(fileMenuRoot, {
    getToken: () => auth()?.token ?? null,
    getBuildingId: () => buildingId,
    getProjectMeta: () => ({ label: buildingLabel, external_ref: buildingExternalRef }),
    invokeString: (name, args) => invokeString(name, args),
    apiAuthHeaders: () => auth ? apiAuthHeaders(auth().token, true) : {},
    openBuilding: (id) => loadFloormapSections(id),
    saveProject: async () => {
      if (!buildingId) throw new Error("Geen project geselecteerd");
      setStatus("Plattegrond/gevel worden per actie opgeslagen \u2014 projectcontext bewaard", "ok");
    },
    onProjectRenamed: (meta) => {
      buildingLabel = meta.label;
      buildingExternalRef = meta.external_ref;
    },
    onProjectDeleted: async () => {
      const deletedBid = buildingId;
      clearLastSectionId(deletedBid);
      buildingId = "";
      buildingLabel = "";
      buildingExternalRef = "";
      buildingInput.value = "";
      sections = [];
      rooms = [];
      pickerPanelEl.classList.add("hidden");
      workspacePanelEl.classList.add("hidden");
      const url = new URL(location.href);
      url.searchParams.delete("building_id");
      url.searchParams.delete("section_id");
      history.replaceState(null, "", url.toString());
      if (gaLinkEl) gaLinkEl.href = "/ga.html";
    },
    onStatus: (state, text) => setStatus(text, state),
    setTitle: (title) => {
      document.title = title === "Geen project" ? "Stilte advies en meten \u2014 Tekeninganalyse" : `${title} \u2014 Plattegrond`;
    }
  });
  fileMenuRoot.hidden = true;
}
session.connect();
/*! Bundled license information:

polygon-clipping/dist/polygon-clipping.umd.js:
  (**
   * splaytree v3.1.2
   * Fast Splay tree for Node and browser
   *
   * @author Alexander Milevski <info@w8r.name>
   * @license MIT
   * @preserve
   *)
  (*! *****************************************************************************
      Copyright (c) Microsoft Corporation. All rights reserved.
      Licensed under the Apache License, Version 2.0 (the "License"); you may not use
      this file except in compliance with the License. You may obtain a copy of the
      License at http://www.apache.org/licenses/LICENSE-2.0
  
      THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
      KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
      WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
      MERCHANTABLITY OR NON-INFRINGEMENT.
  
      See the Apache Version 2.0 License for specific language governing permissions
      and limitations under the License.
      ***************************************************************************** *)
*/
