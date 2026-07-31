var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
  if (ring.length < 3) return closeRing(ring);
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
  return closeRing(rec(ring));
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
  { nr: 9, name: "Kier- en naaddichtingsprofielen" }
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
  return closeRing([
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
      ring = closeRing(rdpSimplify(mapped, Math.max(0.6, Math.min(w0, h0) * 15e-4)));
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

// src/floormap.ts
var params = new URLSearchParams(location.search);
var BPP_WS = resolveBppWsUrl();
var AUTH_KEY = "app_gevelwering_engineer_auth";
var URL_BUILDING = params.get("building_id") || "";
var URL_SECTION = params.get("section_id") || "";
var COMPONENT_DRAFT_KEY = "app-gevelwering-fm-component-draft";
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
var calibrateBtn = document.getElementById("fm-calibrate-btn");
var scaleStatusEl = document.getElementById("fm-scale-status");
var calibrateMetresWrap = document.getElementById("fm-calibrate-metres-wrap");
var calibrateMetresInput = document.getElementById("fm-calibrate-metres");
var calibrateApplyBtn = document.getElementById("fm-calibrate-apply-btn");
var calibrateRepickBtn = document.getElementById("fm-calibrate-repick-btn");
var calibrateHintEl = document.getElementById("fm-calibrate-hint");
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
var roomLevelSelect = document.getElementById("fm-room-level");
var roomPendingHintEl = document.getElementById("fm-room-pending-hint");
var roomDrawBtn = document.getElementById("fm-room-draw-btn");
var roomCloseBtn = document.getElementById("fm-room-close-btn");
var roomSimplifyBtn = document.getElementById("fm-room-simplify-btn");
var roomSaveBtn = document.getElementById("fm-room-save-btn");
var roomClearBtn = document.getElementById("fm-room-clear-btn");
var discoverBtnSide = document.getElementById("fm-discover-btn-side");
var setOpsFieldset = document.getElementById("fm-set-ops-fieldset");
var materialBlockEl = document.getElementById("fm-material-block");
var composePartsEl = document.getElementById("fm-compose-parts");
var composeFeedbackEl = document.getElementById("fm-compose-feedback");
var materialCategoryEl = document.getElementById("fm-material-category");
var materialSubcategoryEl = document.getElementById(
  "fm-material-subcategory"
);
var materialFilterEl = document.getElementById("fm-material-filter");
var materialEigenOnlyEl = document.getElementById("fm-material-eigen-only");
var materialEigenFilterLabelEl = document.getElementById("fm-eigen-filter-label");
var materialEigenFilterStateEl = document.getElementById("fm-eigen-filter-state");
var materialIdEl = document.getElementById("fm-material-id");
var openMatCatalogBtn = document.getElementById("fm-open-mat-btn");
var customMatToggleBtn = document.getElementById("fm-custom-mat-toggle");
var customMatPanelEl = document.getElementById("fm-custom-mat-panel");
var customMatForm = document.getElementById("fm-custom-mat-form");
var customMatRubriekEl = document.getElementById("fm-custom-mat-rubriek");
var customMatNameEl = document.getElementById("fm-custom-mat-name");
var customMatRaEl = document.getElementById("fm-custom-mat-ra");
var customMatCancelBtn = document.getElementById("fm-custom-mat-cancel");
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
var roomCountEl = document.getElementById("fm-room-count");
var roomsHintEl = document.getElementById("fm-rooms-hint");
var roomListEl = document.getElementById("fm-room-list");
var gaLinkEl = document.getElementById("fm-ga-link");
var markRoomLegendEl = document.querySelector("#fm-mark-room-fieldset legend");
var savedRoomsHeadingEl = document.getElementById("fm-saved-heading");
var pickerHeadingEl = document.querySelector("#fm-picker-panel h2");
var pickerHintEl = document.querySelector("#fm-picker-panel > .hint");
var pageTitleEl = document.querySelector("h1");
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
function activePartNoun() {
  return partNoun(activeSection?.region_kind);
}
function levelLabel(hint) {
  switch (String(hint || "").toUpperCase()) {
    case "GROUND":
      return "Begane vloer";
    case "FIRST":
      return "Verdieping";
    case "SECOND":
      return "2e verdieping";
    case "THIRD":
      return "3e verdieping";
    case "ROOF":
      return "Dak";
    case "OTHER":
      return "Overig";
    default:
      return hint || "Overig";
  }
}
function isFloormapKind(kind) {
  return String(kind || activeSection?.region_kind || "FLOORMAP").toUpperCase() === "FLOORMAP";
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
  if (form.vg_nr != null && form.vr_nr != null) return form;
  const subj = differenceSubject(selected);
  if (subj?.vg_nr != null && subj.vr_nr) {
    return { vg_nr: Number(subj.vg_nr), vr_nr: String(subj.vr_nr) };
  }
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
  if (vrs.length === 1 && vgs.length === 1) {
    return { vg_nr: vgs[0], vr_nr: vrs[0] };
  }
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
  return 1;
}
function fillVgVrSuggestions() {
  if (!isFloormapKind()) {
    roomVgInput.value = "";
    roomVrInput.value = "";
    return;
  }
  roomVgInput.value = String(suggestVgNr());
  roomVrInput.value = String(suggestNextVrNr());
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
  discoverBtn.textContent = `Ontdek ${n.plural}`;
  if (discoverBtnSide) discoverBtnSide.textContent = `Ontdek ${n.plural}`;
  if (markRoomLegendEl) markRoomLegendEl.textContent = cap;
  roomDrawBtn.textContent = `Teken ${n.singular}`;
  roomSaveBtn.textContent = `${cap} opslaan`;
  roomLabelInput.placeholder = floormap ? "bijv. slaapkamer 1" : "bijv. raamstrook / paneel";
  roomPendingHintEl.textContent = `Gebruik Teken ${n.singular} in Tools, klik hoekpunten, sluit af en sla op. Dubbelklik een anker om te verwijderen; Vereenvoudig dunt de omtrek.`;
  if (savedRoomsHeadingEl) {
    const badge = (roomCountEl && document.body.contains(roomCountEl) ? roomCountEl : null) || document.getElementById("fm-room-count");
    savedRoomsHeadingEl.textContent = `Opgeslagen ${n.plural} `;
    if (badge) {
      badge.className = "region-count-badge";
      badge.id = "fm-room-count";
      savedRoomsHeadingEl.appendChild(badge);
    }
  }
  if (roomsHintEl) {
    roomsHintEl.textContent = floormap ? `Elke ${n.singular} toont VG/VR, oppervlakte (m\xB2) en omtrek (m) bij ingestelde schaal.` : `Elke ${n.singular} met VG/VR telt later mee in de berekening gevelwering voor die VR. Alleen bronnen met hetzelfde materiaal (of zonder materiaal) worden vervangen door een compositie \u2014 andere materialen blijven beschikbaar. Selecteer voor +/\u2212 compositie.`;
  }
  vgVrRowEl?.classList.remove("hidden");
  if (vgVrHintEl) {
    vgVrHintEl.classList.remove("hidden");
    vgVrHintEl.textContent = floormap ? "Zelfde VG + andere VR = ruimten in hetzelfde verblijfsgebied. VR is uniek per project (bijv. 1, 3A)." : "Koppel aan een VR (zelfde als plattegrond). Meerdere composities (materialen) binnen dezelfde buitencontour zijn mogelijk.";
  }
  setOpsFieldset?.classList.toggle("hidden", floormap);
  materialBlockEl?.classList.toggle("hidden", floormap);
  if (floormap) {
    selectedSetIds.clear();
    constituentSigns.clear();
    booleanPreview = null;
  } else {
    materialCategoriesLoaded = false;
    void ensureMaterialCategories();
  }
  renderComposeParts();
}
var ws = null;
var sessionId = null;
var auth = null;
var reqCounter = 0;
var pending = /* @__PURE__ */ new Map();
var buildingId = URL_BUILDING;
var sections = [];
var activeSection = null;
var rooms = [];
var selectedSetIds = /* @__PURE__ */ new Set();
var constituentSigns = /* @__PURE__ */ new Map();
var booleanPreview = null;
var materialCategoriesLoaded = false;
var materialCategoryMeta = [];
var catalogMaterials = [];
var materialFilterTimer = null;
var linkedRooms = /* @__PURE__ */ new Map();
var pdfDoc = null;
var cropBitmap = null;
var cropWidthPdfPts = 0;
var canvasWidth = 0;
var canvasHeight = 0;
var viewZoom = 1;
var ZOOM_MIN = 0.5;
var ZOOM_MAX = 4;
var ZOOM_STEP = 0.25;
var discovery = null;
var calibrate = null;
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
function nextRequestId(prefix) {
  reqCounter += 1;
  return `${prefix}_${reqCounter}_${Date.now()}`;
}
function storeAuth2(info) {
  storeAuth(AUTH_KEY, info);
  void syncSessionCookie(info?.token ?? null);
}
function loadStoredAuth() {
  return loadAuth(AUTH_KEY);
}
function showLogin() {
  auth = null;
  storeAuth2(null);
  loginPanelEl.classList.remove("hidden");
  panelEl.classList.add("hidden");
}
function showPanel(info) {
  auth = info;
  storeAuth2(info);
  loginPanelEl.classList.add("hidden");
  panelEl.classList.remove("hidden");
  userLabelEl.textContent = `Signed in as ${info.display_name || info.username}`;
}
function send(type, payload, wantType) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return Promise.reject(new Error("WebSocket not open"));
  }
  const request_id = nextRequestId(type.replace(".", "_"));
  const env = { v: 1, type, request_id, payload };
  if (sessionId && type !== "session.open") env.session_id = sessionId;
  return new Promise((resolve, reject) => {
    pending.set(request_id, { resolve, reject, want: wantType });
    ws.send(JSON.stringify(env));
  });
}
function onMessage(raw) {
  let env;
  try {
    env = JSON.parse(raw);
  } catch {
    return;
  }
  if (env.type === "session.opened") {
    const sid = typeof env.session_id === "string" && env.session_id || (typeof env.payload?.session_id === "string" ? env.payload.session_id : null);
    if (sid) sessionId = sid;
  }
  if (env.type === "error") {
    const waiter2 = pending.get(env.request_id);
    if (waiter2) {
      pending.delete(env.request_id);
      waiter2.reject(new Error(JSON.stringify(env.payload ?? env)));
    }
    return;
  }
  const waiter = pending.get(env.request_id);
  if (!waiter) return;
  if (env.type === waiter.want || env.type.endsWith(".completed") || env.type === "exec.completed") {
    if (env.type === "invoke.accepted" || env.type === "exec.accepted") return;
    pending.delete(env.request_id);
    waiter.resolve(env);
  }
}
async function invokeString(target, args) {
  const inv = await send("invoke.request", { target_kind: "procedure", target, args }, "invoke.completed");
  const ret = inv.payload?.return;
  if (typeof ret !== "string") throw new Error(`Unexpected return from ${target}`);
  return ret;
}
async function loadSharedApi() {
  await send(
    "exec.request",
    { code: 'INCLUDE "fixtures/app-gevelwering/shared_building_api.basicpp"\n' },
    "exec.completed"
  );
  const bootRet = await invokeString("API_Bootstrap", []);
  if (!bootRet.startsWith("OK")) throw new Error(`API_Bootstrap failed: ${bootRet}`);
}
async function bootstrapAndLogin(username, password) {
  await loadSharedApi();
  const ret = await invokeString("API_Login", [username, password]);
  if (ret.startsWith("ERROR")) throw new Error(ret);
  const parsed = JSON.parse(ret);
  if (!parsed.ok || !parsed.token) throw new Error("Login failed");
  showPanel({
    token: parsed.token,
    username: parsed.username || username,
    display_name: parsed.display_name || username
  });
}
function authHeaders() {
  return apiAuthHeaders(auth.token, true);
}
async function apiGet(url) {
  const res = await fetch(url, {
    credentials: "include",
    headers: apiAuthHeaders(auth.token)
  });
  const body = await res.json();
  if (!res.ok || body.ok === false) {
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return body;
}
async function apiPost(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  const body = await res.json();
  if (!res.ok || body.ok === false) {
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return body;
}
async function apiDelete(url) {
  const res = await fetch(url, {
    method: "DELETE",
    credentials: "include",
    headers: apiAuthHeaders(auth.token)
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
    scaleStatusEl.textContent = "Not set";
    calibrateHintEl.textContent = "Click Calibrate scale when you are ready.";
    if (roomsHintEl) roomsHintEl.textContent = `Set drawing scale to get ${n.singular} areas in m\xB2.`;
    return;
  }
  const mpu = activeSection.metres_per_norm_unit;
  const ratio = activeSection.scale_ratio;
  const src = (activeSection.scale_source || "NONE").toUpperCase();
  if (mpu != null && mpu > 0) {
    if (ratio != null && ratio > 0) {
      const from = src === "PDF_TEXT" ? " (from drawing text)" : src === "CALIBRATED" ? " (calibrated)" : "";
      scaleStatusEl.textContent = `Paper scale 1:${ratio}${from}`;
    } else {
      scaleStatusEl.textContent = src === "CALIBRATED" ? "Scale set from marked length" : `Scale set \u2014 ${n.singular} sizes in m\xB2 / m`;
    }
    calibrateHintEl.textContent = `Scale is ready. Use Length to check a distance, or Draw ${n.singular} \u2014 circ/area update from the polygon.`;
    if (roomsHintEl) {
      roomsHintEl.textContent = `${n.singular.charAt(0).toUpperCase() + n.singular.slice(1)} area (m\xB2) and perimeter (m) use this scale.`;
    }
    calibrateBtn.textContent = "Recalibrate scale";
  } else {
    scaleStatusEl.textContent = "Not set \u2014 mark a known length, or use detected 1:N";
    calibrateHintEl.textContent = "Click Calibrate scale, mark two points, then enter that length in mm.";
    if (roomsHintEl) roomsHintEl.textContent = "Without scale, only relative sizes are shown.";
    calibrateBtn.textContent = "Calibrate scale";
  }
  updateToolHint();
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
function ringForMetrics() {
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
  } else {
    toolLengthMmEl.value = "\u2014";
  }
  const ring = ringForMetrics();
  if (ring) {
    toolCircMmEl.value = fmtMeasure(pathLengthM(ring.pts, mpu, ring.closed), 2);
    toolAreaMm2El.value = ring.pts.length >= 3 ? fmtMeasure(pathAreaM2(ring.pts, mpu), 2) : "\u2014";
  } else {
    toolCircMmEl.value = "\u2014";
    toolAreaMm2El.value = "\u2014";
  }
}
function updateToolHint() {
  if (!toolHintEl) return;
  const n = activePartNoun();
  if (!activeScaleMpu()) {
    toolHintEl.textContent = `Set scale first, then measure a length or draw a ${n.singular}.`;
    return;
  }
  if (pendingRoom?.drawing && !pendingRoom.closed) {
    toolHintEl.textContent = pendingRoom.points.length === 0 ? `Click ${n.singular} corners. Circumference updates as you go; area after 3 points.` : `${pendingRoom.points.length} vertex(es). Close polygon (\u22653) or click near start.`;
    return;
  }
  if (pendingRoom?.closed) {
    toolHintEl.textContent = `${n.singular.charAt(0).toUpperCase() + n.singular.slice(1)} polygon ready \u2014 circ/area shown. Drag vertices or Save ${n.singular}.`;
    return;
  }
  if (measure.tool === "length") {
    toolHintEl.textContent = measure.points.length < 2 ? "Click two points to measure length (updates live while moving)." : "Length ready. Clear or click again to start over.";
    return;
  }
  toolHintEl.textContent = `Choose Length or Draw ${n.singular}. Circumference and area come from the polygon.`;
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
      setStatus("Finish or cancel room discovery before measuring", "err");
      syncToolButtons();
      return;
    }
    if (!activeScaleMpu()) {
      setStatus("Set scale first", "err");
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
  if (tool === "length") setStatus("Measure length: click two points", "busy");
}
function renderSectionList() {
  sectionListEl.innerHTML = "";
  if (sections.length === 0) {
    sectionListEl.innerHTML = `<p class="hint">Geen schaalbare secties (plattegrond / gevel / doorsnede) voor dit project.</p>`;
    return;
  }
  for (const s of sections) {
    const card = document.createElement("article");
    card.className = "admin-project-card panel";
    const hasComponents = (s.room_count || 0) >= 1;
    const n = partNoun(s.region_kind);
    const scale = s.metres_per_norm_unit != null && s.metres_per_norm_unit > 0 ? `schaal gezet (${s.scale_source})` : "geen schaal";
    const countLabel = s.room_count === 1 ? `1 ${n.singular}` : `${s.room_count} ${n.plural}`;
    card.innerHTML = `
      <h3>${s.label || n.title}</h3>
      <p class="hint">${n.kindLabel} \xB7 pagina ${s.page_index + 1} \xB7 ${countLabel} \xB7 ${scale}</p>
    `;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = hasComponents ? "section-open-btn section-open-btn--filled" : "section-open-btn section-open-btn--empty";
    btn.textContent = `Open ${n.title.toLowerCase()}`;
    btn.addEventListener("click", () => {
      void openSection(s.id);
    });
    card.appendChild(btn);
    sectionListEl.appendChild(card);
  }
}
function selectedIsKierdichting() {
  const mat = selectedCatalogMaterial();
  if (!mat) return false;
  return isLengthQuantityRubriek(mat.rubriek_nr ?? mat.master_category);
}
function componentIsLengthQuantity(r) {
  const a = r.analysis;
  if (a?.quantity_kind === "length") return true;
  if (a?.length_m != null && Number.isFinite(a.length_m)) return true;
  return isLengthQuantityRubriek(a?.rubriek_nr ?? a?.master_category);
}
function roomMetricsLabel(r) {
  const mpu = r.metres_per_norm_unit != null && r.metres_per_norm_unit > 0 ? r.metres_per_norm_unit : activeScaleMpu();
  const aspect = activeScaleAspect();
  const live = pendingRoom?.editingId === r.id ? pendingRoom : null;
  const pts = live ? live.points : r.points;
  const holes = live ? live.holes || [] : Array.isArray(r.analysis?.holes) ? r.analysis.holes : [];
  const closed = live ? live.closed : true;
  if (componentIsLengthQuantity(r) || live && !closed && selectedIsKierdichting()) {
    let len = null;
    if (pts?.length >= 2 && mpu) {
      len = `${scaledPathLength(pts, mpu, aspect, closed).toFixed(2)} m`;
    } else if (r.analysis?.length_m != null && Number.isFinite(r.analysis.length_m) && !live) {
      len = `${Number(r.analysis.length_m).toFixed(2)} m`;
    } else if (r.perimeter_m != null && Number.isFinite(r.perimeter_m) && !live) {
      len = `${r.perimeter_m.toFixed(2)} m`;
    }
    return len ? `lengte ${len}` : "lengte \u2014";
  }
  let area = "\u2014";
  let circ = "\u2014";
  if (pts?.length >= 3 && mpu) {
    const holesSum = holes.reduce((s, h) => s + shoelaceArea(h), 0);
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
    area = `${r.area_norm.toFixed(4)} (no scale)`;
  }
  return `${area} \xB7 circ ${circ}`;
}
var roomListRefreshTimer = null;
function scheduleRoomListRefresh() {
  if (!pendingRoom?.editingId) return;
  if (roomListRefreshTimer) clearTimeout(roomListRefreshTimer);
  roomListRefreshTimer = setTimeout(() => {
    roomListRefreshTimer = null;
    renderRoomList();
  }, 40);
}
function syncPendingRoomButtons() {
  const n = activePartNoun();
  const cap = n.singular.charAt(0).toUpperCase() + n.singular.slice(1);
  const has = Boolean(pendingRoom && pendingRoom.points.length > 0);
  const closed = Boolean(pendingRoom?.closed);
  const kier = !isFloormapKind() && selectedIsKierdichting();
  roomCloseBtn.disabled = !(pendingRoom?.drawing && pendingRoom.points.length >= 3 && !closed);
  const canSaveClosed = Boolean(closed && pendingRoom && pendingRoom.points.length >= 3);
  const canSaveOpenKier = Boolean(
    kier && pendingRoom && !closed && pendingRoom.points.length >= 2
  );
  roomSaveBtn.disabled = !(canSaveClosed || canSaveOpenKier);
  roomClearBtn.disabled = !has && !pendingRoom?.drawing;
  if (roomSimplifyBtn) {
    roomSimplifyBtn.disabled = !(closed && pendingRoom && ringVertexCount(pendingRoom.points) > 3);
  }
  if (!pendingRoom) {
    roomPendingHintEl.textContent = kier ? `Kierdichting: teken een pad (\u22652 punten) of gesloten omtrek; lengte in meters wordt opgeslagen.` : `Gebruik Teken ${n.singular} (Tools of hier), klik hoekpunten. Dubbelklik een anker om te verwijderen; Vereenvoudig dunt de omtrek.`;
    roomDrawBtn.textContent = `Teken ${n.singular}`;
    return;
  }
  if (pendingRoom.drawing && !pendingRoom.closed) {
    roomPendingHintEl.textContent = kier ? `${pendingRoom.points.length} punt(en). Opslaan mag vanaf 2 punten (lengte), of sluit polygoon voor omtrek.` : `${pendingRoom.points.length} hoekpunt(en). Omtrek/oppervlakte hierboven; sluit polygoon als klaar (\u22653).`;
    roomDrawBtn.textContent = "Tekenen annuleren";
  } else if (pendingRoom.closed) {
    roomPendingHintEl.textContent = pendingRoom.editingId ? "Bewerken geometrie \u2014 sleep witte ankers, daarna Opslaan. (Labeltekst hierboven aanpassen kan ook.)" : kier ? "Polygoon klaar \u2014 omtrek (m) wordt als lengte opgeslagen voor kierdichting." : "Polygoon klaar \u2014 dubbelklik ankers om te verwijderen, of Vereenvoudig, daarna Opslaan.";
    roomDrawBtn.textContent = `Teken ${n.singular}`;
  }
  roomSaveBtn.textContent = `${cap} opslaan`;
  if (markRoomLegendEl) markRoomLegendEl.textContent = cap;
}
function clearPendingRoom() {
  pendingRoom = null;
  syncPendingRoomButtons();
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
  pendingRoom = {
    points: [],
    holes: [],
    closed: false,
    editingId: null,
    dragVertex: null,
    drawing: true
  };
  roomLabelInput.value = `${activePartNoun().singular.charAt(0).toUpperCase() + activePartNoun().singular.slice(1)} ${rooms.length + 1}`;
  fillVgVrSuggestions();
  syncPendingRoomButtons();
  syncToolButtons();
  updateMeasureReadouts();
  updateToolHint();
  setStatus("Klik hoeken van de ruimte op de tekening", "busy");
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
  syncPendingRoomButtons();
  syncToolButtons();
  updateMeasureReadouts();
  updateToolHint();
  scheduleRoomListRefresh();
  setStatus(`Polygoon gesloten \u2014 sla ${activePartNoun().singular} op als klaar`, "ok");
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
        `\u201C${r.label || r.id}\u201D past niet volledig binnen de buitencontour \u201C${outer.label || outer.id}\u201D`
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
  if (!activeSection || !auth?.token || !rootId) return 0;
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
        await apiPost("/api/floormap/subsections", {
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
  if (!pendingRoom || !activeSection || !auth) return;
  const kier = !isFloormapKind() && selectedIsKierdichting();
  const openPath = Boolean(kier && !pendingRoom.closed && pendingRoom.points.length >= 2);
  if (!openPath && !pendingRoom.closed) return;
  const points = openPath ? clampPath(pendingRoom.points) : closeRing(pendingRoom.points);
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
  const label = roomLabelInput.value.trim() || `${activePartNoun().singular.charAt(0).toUpperCase() + activePartNoun().singular.slice(1)} ${rooms.length + 1}`;
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
  const mat = !isFloormapKind() ? selectedCatalogMaterial() : null;
  if (kier && !mat) {
    setStatus("Kies een kierdichtingsmateriaal (rubriek 9)", "err");
    return;
  }
  roomSaveBtn.disabled = true;
  setStatus(pendingRoom.editingId ? "Geometrie bijwerken\u2026" : "Opslaan\u2026", "busy");
  try {
    const holes = openPath ? [] : pendingRoom.holes || [];
    const editingId = pendingRoom.editingId;
    const body = {
      section_id: activeSection.id,
      subsection_id: editingId || void 0,
      label,
      level_hint: level,
      vg_nr: vgVr.vg_nr,
      vr_nr: vgVr.vr_nr,
      points,
      holes,
      metres_per_norm_unit: mpu ?? void 0,
      open_path: openPath || void 0,
      scale_aspect_yx: activeScaleAspect()
    };
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
      body.analysis = analysis;
      if (!editingId && !roomLabelInput.value.trim()) {
        body.label = `${mat.master_category}: ${mat.name}`;
      }
    }
    const saved = await apiPost("/api/floormap/subsections", body);
    const wasEdit = Boolean(editingId);
    clearPendingRoom();
    if (isFloormapKind()) {
      roomVgInput.value = "";
      roomVrInput.value = "";
    }
    await loadRooms();
    let depCount = 0;
    if (wasEdit && editingId) {
      setStatus("Afgeleide setbewerkingen herberekenen\u2026", "busy");
      depCount = await recalculateBooleanDependents(editingId);
      if (depCount > 0) await loadRooms();
    }
    const m2 = saved.area_m2 != null ? Number(saved.area_m2) : null;
    const lenM = saved.analysis?.length_m != null ? Number(saved.analysis.length_m) : saved.perimeter_m != null ? Number(saved.perimeter_m) : null;
    const depBit = depCount > 0 ? ` \xB7 ${depCount} afgeleide${depCount === 1 ? "" : "n"} herberekend` : "";
    setStatus(
      wasEdit ? kier && lenM != null ? `Geometrie bijgewerkt \xB7 lengte ${lenM.toFixed(2)} m${depBit}` : m2 != null ? `Geometrie bijgewerkt \xB7 ${m2.toFixed(2)} m\xB2${depBit}` : `Geometrie bijgewerkt${depBit}` : kier && lenM != null ? `Opgeslagen ${String(body.label)} \xB7 lengte ${lenM.toFixed(2)} m` : m2 != null ? `Opgeslagen ${String(body.label)} \xB7 ${m2.toFixed(2)} m\xB2` : `Opgeslagen ${String(body.label)}`,
      "ok"
    );
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
    syncPendingRoomButtons();
  }
}
function editRoom(room) {
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
    drawing: false
  };
  roomLabelInput.value = room.label;
  roomLevelSelect.value = room.level_hint || "OTHER";
  roomVgInput.value = room.vg_nr != null ? String(room.vg_nr) : "";
  roomVrInput.value = room.vr_nr != null ? String(room.vr_nr) : "";
  void applyMaterialSelectionFromAnalysis(room.analysis);
  syncPendingRoomButtons();
  syncToolButtons();
  updateMeasureReadouts();
  updateToolHint();
  renderRoomList();
  const selectedLi = document.querySelector("#fm-room-list .drawing-list-item.selected");
  selectedLi?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  scrollToRing(pendingRoom.points);
  setStatus(
    `Bewerken: ${room.label} \u2014 sleep ankers op de tekening, daarna \xAB${activePartNoun().singular.charAt(0).toUpperCase() + activePartNoun().singular.slice(1)} opslaan\xBB`,
    "ok"
  );
  drawOverlay();
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
  try {
    const selected = rooms.filter((r) => selectedSetIds.has(r.id));
    const { parts } = buildComposeParts(selected);
    booleanPreview = composeSigned(parts.map((p) => ({ ring: p.room.points, sign: p.sign })));
  } catch {
    booleanPreview = null;
  }
  renderComposeParts();
  drawOverlay();
}
function materialAnalysisLabel(a) {
  if (!a) return "";
  const op = booleanOpSymbol(a.boolean_op);
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
  const id = (materialIdEl?.value || "").trim();
  if (!id) return null;
  return catalogMaterials.find((m) => m.material_id === id) || null;
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
    const eigen = (m.source || "").trim().toLowerCase() === "eigen" ? " \xB7 eigen" : "";
    opt.textContent = code ? `${code} \xB7 ${m.name}${sub}${ra}${eigen}` : `${m.name}${sub}${ra}${eigen}`;
    opt.title = code ? `${code} \xB7 ${m.name}` : m.name;
    materialIdEl.appendChild(opt);
  }
  materialIdEl.disabled = materials.length === 0;
  if (selectedId && materials.some((m) => m.material_id === selectedId)) {
    materialIdEl.value = selectedId;
  }
}
async function ensureMaterialCategories() {
  if (!auth?.token || !materialCategoryEl) return;
  if (materialCategoriesLoaded && materialCategoryEl.options.length > 1) return;
  try {
    const data = await apiGet("/api/floormap/material-categories");
    renderMaterialCategoryOptions(data.categories || []);
    materialCategoriesLoaded = true;
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  }
}
async function loadMaterialsForCategory(category, q = "") {
  if (!auth?.token || !materialIdEl) return;
  const keep = materialIdEl.value;
  const eigenOnly = Boolean(materialEigenOnlyEl?.checked);
  if (!category && !eigenOnly) {
    catalogMaterials = [];
    renderMaterialNameOptions([]);
    materialIdEl.disabled = true;
    updateMaterialSpectrumPreview(null);
    return;
  }
  materialIdEl.disabled = true;
  try {
    const params2 = new URLSearchParams({
      limit: "1000"
    });
    if (category) params2.set("master_category", category);
    if (eigenOnly) params2.set("source", "eigen");
    const sub = (materialSubcategoryEl?.value || "").trim();
    if (sub && category) params2.set("category", sub);
    if (q.trim()) params2.set("q", q.trim());
    const data = await apiGet(
      `/api/floormap/materials?${params2.toString()}`
    );
    catalogMaterials = data.materials || [];
    renderMaterialNameOptions(catalogMaterials, keep);
    updateMaterialSpectrumPreview();
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
  if (!activeSection || !auth || isFloormapKind()) return;
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
    const saved = await apiPost("/api/floormap/subsections", {
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
    booleanPreview = null;
    await loadRooms();
    updateBooleanPreview();
    const savedM2 = saved.area_m2 != null ? Number(saved.area_m2) : areaM2;
    const okMsg = savedM2 != null ? `Opgeslagen: ${label} (netto ${savedM2.toFixed(2)} m\xB2). Selectie blijft staan voor een volgende compositie.` : `Opgeslagen: ${label}. Selectie blijft staan voor een volgende compositie.`;
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
function renderRoomList() {
  const listEl = roomListEl || document.getElementById("fm-room-list");
  const countEl = (roomCountEl && document.body.contains(roomCountEl) ? roomCountEl : null) || document.getElementById("fm-room-count");
  if (!listEl) return;
  listEl.replaceChildren();
  if (countEl) countEl.textContent = String(rooms.length);
  if (rooms.length === 0) {
    const li = document.createElement("li");
    li.className = "hint drawing-list-empty";
    li.textContent = `Nog geen ${activePartNoun().plural} \u2014 Teken ${activePartNoun().singular} of Ontdek.`;
    listEl.appendChild(li);
    return;
  }
  const allowSetSelect = !isFloormapKind();
  const booleanSourceIds = allowSetSelect ? collectBooleanSourceIds(rooms) : /* @__PURE__ */ new Set();
  const supersededIds = allowSetSelect ? collectSupersededSourceIds(rooms) : /* @__PURE__ */ new Set();
  const boolGroups = allowSetSelect ? assignBooleanListGroups(rooms) : /* @__PURE__ */ new Map();
  rooms.forEach((r, index) => {
    const li = document.createElement("li");
    li.className = "drawing-list-item";
    if (allowSetSelect) li.classList.add("drawing-list-item--set");
    if (pendingRoom?.editingId === r.id) li.classList.add("selected");
    if (allowSetSelect && selectedSetIds.has(r.id)) li.classList.add("set-selected");
    if (allowSetSelect && booleanSourceIds.has(r.id)) li.classList.add("drawing-list-item--ga-source");
    const boolRole = boolGroups.get(r.id);
    if (boolRole) applyBooleanListColors(li, boolRole);
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
      });
      li.appendChild(cb);
    }
    const info = document.createElement("button");
    info.type = "button";
    info.className = "drawing-list-select";
    const linked = linkedRooms.get(r.id);
    const nrBit = r.vg_nr != null && r.vr_nr != null ? `VG ${r.vg_nr} \xB7 VR ${r.vr_nr}` : "geen VG/VR";
    const matBit = materialAnalysisLabel(r.analysis);
    let gaBit = "";
    if (allowSetSelect) {
      if (supersededIds.has(r.id)) {
        gaBit = " \xB7 bron (vervangen in berekening)";
      } else if (booleanSourceIds.has(r.id)) {
        gaBit = " \xB7 bron (blijft in berekening)";
      } else if (r.vr_nr && r.analysis?.material_id) {
        gaBit = " \xB7 in berekening";
      } else if (r.vr_nr) {
        gaBit = " \xB7 berekening: nog materiaal";
      }
    }
    const linkBit = activeSection?.region_kind === "FLOORMAP" && linked ? ` \xB7 berekening: ${linked}` : activeSection?.region_kind === "FLOORMAP" ? " \xB7 niet in berekening" : "";
    const parts = [r.label || "(zonder label)", matBit, nrBit, levelLabel(r.level_hint), roomMetricsLabel(r)].filter(
      Boolean
    );
    info.textContent = `${parts.join(" \xB7 ")}${gaBit}${linkBit}`;
    info.title = supersededIds.has(r.id) ? "Bron van een setbewerking met hetzelfde materiaal \u2014 vervangen door het netto-component" : booleanSourceIds.has(r.id) ? "Bron van een setbewerking met ander materiaal \u2014 blijft beschikbaar in de berekening (bijv. glas)" : "Klik om geometrie te bewerken";
    info.addEventListener("click", () => editRoom(r));
    li.appendChild(info);
    const actions = document.createElement("span");
    actions.className = "drawing-list-actions";
    const upBtn = document.createElement("button");
    upBtn.type = "button";
    upBtn.className = "secondary drawing-list-move";
    upBtn.textContent = "Omhoog";
    upBtn.title = "Verplaats omhoog in de lijst";
    upBtn.disabled = index === 0;
    upBtn.addEventListener("click", () => {
      void moveRoom(index, -1);
    });
    actions.appendChild(upBtn);
    const downBtn = document.createElement("button");
    downBtn.type = "button";
    downBtn.className = "secondary drawing-list-move";
    downBtn.textContent = "Omlaag";
    downBtn.title = "Verplaats omlaag in de lijst";
    downBtn.disabled = index >= rooms.length - 1;
    downBtn.addEventListener("click", () => {
      void moveRoom(index, 1);
    });
    actions.appendChild(downBtn);
    if (activeSection?.region_kind === "FLOORMAP" && buildingId) {
      const ga = document.createElement("a");
      ga.className = "secondary-link";
      const q = new URLSearchParams({ building_id: buildingId, subsection_id: r.id });
      if (r.vg_nr != null) q.set("vg_nr", String(r.vg_nr));
      if (r.vr_nr != null && String(r.vr_nr).trim()) q.set("vr_nr", String(r.vr_nr).trim());
      ga.href = `/ga.html?${q.toString()}`;
      ga.textContent = linked ? "Open berekening gevelwering" : "Koppel aan berekening gevelwering";
      ga.title = linked ? "Open dit VG/VR in de berekening gevelwering" : "Neem VG/VR over in de berekening gevelwering";
      actions.appendChild(ga);
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "secondary";
    btn.textContent = "Verwijderen";
    btn.addEventListener("click", () => {
      void deleteRoom(r.id);
    });
    actions.appendChild(btn);
    li.appendChild(actions);
    listEl.appendChild(li);
  });
}
async function refreshLinkedRooms() {
  linkedRooms = /* @__PURE__ */ new Map();
  if (!auth?.token || !buildingId) return;
  try {
    const ret = await invokeString("API_ListLinkedSubsections", [auth.token, buildingId]);
    if (ret.startsWith("ERROR")) return;
    const data = JSON.parse(ret);
    for (const l of data.links || []) {
      linkedRooms.set(l.subsection_id, l.omschrijving);
    }
  } catch {
  }
}
function normalizeSection(s) {
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
    room_count: Number(s.room_count) || 0
  };
}
async function ensureSectionInList(sectionId) {
  if (sections.some((s) => s.id === sectionId)) return true;
  try {
    const data = await apiGet(
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
async function loadFloormapSections(bid) {
  if (!auth?.token) return;
  buildingId = bid.trim();
  if (!buildingId) {
    setStatus("Enter a building id", "err");
    return;
  }
  buildingInput.value = buildingId;
  if (gaLinkEl) {
    gaLinkEl.href = `/ga.html?building_id=${encodeURIComponent(buildingId)}`;
  }
  setStatus("Loading sections\u2026", "busy");
  try {
    await refreshLinkedRooms();
    const data = await apiGet(
      `/api/floormap/sections?building_id=${encodeURIComponent(buildingId)}`
    );
    sections = (data.sections || []).map((s) => normalizeSection(s));
    if (URL_SECTION) {
      await ensureSectionInList(URL_SECTION);
    }
    syncWorkspaceLabels(sections[0]?.region_kind || "FLOORMAP");
    renderSectionList();
    pickerPanelEl.classList.remove("hidden");
    workspacePanelEl.classList.add("hidden");
    setStatus(`${sections.length} section(s)`, "ok");
    if (URL_SECTION && sections.some((s) => s.id === URL_SECTION)) {
      await openSection(URL_SECTION);
    } else if (URL_SECTION) {
      setStatus("Section not found or not scalable \u2014 check engineer review link", "err");
    }
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  }
}
async function loadRooms() {
  if (!auth?.token || !activeSection) return;
  try {
    const data = await apiGet(
      `/api/floormap/subsections?section_id=${encodeURIComponent(activeSection.id)}`
    );
    rooms = (data.subsections || []).map((r) => ({
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
    rooms.sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));
    selectedSetIds = new Set([...selectedSetIds].filter((id) => rooms.some((r) => r.id === id)));
    for (const id of [...constituentSigns.keys()]) {
      if (!selectedSetIds.has(id)) constituentSigns.delete(id);
    }
    renderRoomList();
  } catch (err) {
    rooms = [];
    renderRoomList();
    throw err;
  }
  try {
    updateBooleanPreview();
  } catch {
    booleanPreview = null;
  }
  try {
    await restoreScaleFromRooms();
  } catch {
  }
  try {
    await refreshLinkedRooms();
    renderRoomList();
  } catch {
  }
  drawOverlay();
}
async function restoreScaleFromRooms() {
  if (!activeSection || !auth?.token) return;
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
    await apiPost("/api/floormap/scale", {
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
  if (!activeSection || !auth?.token) return;
  const mpu = activeSection.metres_per_norm_unit;
  if (mpu == null || !(mpu > 0) || canvasWidth < 1 || canvasHeight < 1) return;
  const aspect = canvasHeight / canvasWidth;
  const prev = activeSection.scale_aspect_yx;
  if (prev != null && Math.abs(prev - aspect) < 1e-6) return;
  try {
    await apiPost("/api/floormap/scale", {
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
async function openSection(sectionId) {
  const sec = sections.find((s) => s.id === sectionId);
  if (!sec || !auth?.token) return;
  endDiscovery();
  endCalibrate();
  activeSection = sec;
  const n = partNoun(sec.region_kind);
  syncWorkspaceLabels(sec.region_kind);
  sectionTitleEl.textContent = sec.label || n.title;
  sectionMetaEl.textContent = `${n.kindLabel} \xB7 page ${sec.page_index + 1} \xB7 ${sec.document_id.slice(0, 8)}\u2026`;
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
    headers: apiAuthHeaders(auth.token)
  });
  if (!res.ok) throw new Error(`Failed to load PDF (HTTP ${res.status})`);
  const buf = await res.arrayBuffer();
  const pdfjsLib = window.pdfjsLib;
  if (!pdfjsLib) throw new Error("PDF.js not loaded");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  pdfDoc = await pdfjsLib.getDocument({ data: buf }).promise;
  const pageNum = Math.min(pdfDoc.numPages, Math.max(1, sec.page_index + 1));
  const page = await pdfDoc.getPage(pageNum);
  const renderScale = 2.5;
  const rotation = typeof page.rotate === "number" ? page.rotate : 0;
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
  viewZoom = 1;
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
    await apiPost("/api/floormap/scale", {
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
    calibrateHintEl.textContent = `Detected paper scale 1:${found} from PDF text.`;
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
  zoomLabelEl.textContent = `${Math.round(viewZoom * 100)}%`;
  drawOverlay();
}
function updateZoomLabel() {
  zoomLabelEl.textContent = `${Math.round(viewZoom * 100)}%`;
}
async function setViewZoom(next) {
  viewZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
  updateZoomLabel();
  await paintCropView();
}
async function zoomToFit() {
  if (!cropBitmap) return;
  const avail = Math.max(200, pdfScrollEl.clientWidth - 16);
  await setViewZoom(avail / cropBitmap.width);
}
function canvasToNorm(cx, cy) {
  return {
    x: Math.min(1, Math.max(0, cx / Math.max(1, canvasWidth))),
    y: Math.min(1, Math.max(0, cy / Math.max(1, canvasHeight)))
  };
}
function normToCanvas(p) {
  return { x: p.x * canvasWidth, y: p.y * canvasHeight };
}
function eventToCanvas(ev) {
  const rect = overlayCanvas.getBoundingClientRect();
  return {
    x: (ev.clientX - rect.left) / Math.max(1, rect.width) * canvasWidth,
    y: (ev.clientY - rect.top) / Math.max(1, rect.height) * canvasHeight
  };
}
function drawPolyline(ctx, points, stroke, fill, lineWidth, opts) {
  if (points.length < 2) return;
  const holes = (opts?.holes || []).filter((h) => h.length >= 3);
  ctx.beginPath();
  const first = normToCanvas(points[0]);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < points.length; i++) {
    const p = normToCanvas(points[i]);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  for (const hole of holes) {
    const h0 = normToCanvas(hole[0]);
    ctx.moveTo(h0.x, h0.y);
    for (let i = 1; i < hole.length; i++) {
      const p = normToCanvas(hole[i]);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
  }
  if (fill) {
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
    for (const pt of verts) {
      const c = normToCanvas(pt);
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  if (opts?.label) {
    const xs = points.map((p) => normToCanvas(p).x);
    const ys = points.map((p) => normToCanvas(p).y);
    const lx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const ly = Math.min(...ys) - 8;
    ctx.fillStyle = stroke;
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(opts.label, lx, Math.max(12, ly));
  }
}
function drawOverlay() {
  const ctx = overlayCanvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  for (const r of rooms) {
    if (!r.points?.length) continue;
    const selected = selectedSetIds.has(r.id);
    const holes = Array.isArray(r.analysis?.holes) ? r.analysis.holes.map((h) => coerceRingPoints(h)).filter((h) => h.length >= 3) : [];
    drawPolyline(
      ctx,
      r.points,
      selected ? "#1565c0" : "#6a1b9a",
      selected ? "rgba(21,101,192,0.18)" : "rgba(106,27,154,0.12)",
      selected ? 2.2 : 1.5,
      holes.length ? { holes } : void 0
    );
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
  if (discovery) {
    discovery.candidates.forEach((ring, i) => {
      if (i === discovery.index) return;
      drawPolyline(ctx, ring, "#9e9e9e", "rgba(158,158,158,0.06)", 1.5, { dash: [4, 4] });
    });
    if (discovery.current.length >= 2) {
      drawPolyline(ctx, discovery.current, "#c62828", "rgba(198,40,40,0.12)", 2.5, {
        dash: [8, 4],
        vertexHandles: true,
        label: `Candidate ${discovery.index + 1}`
      });
    }
  }
  if (pendingRoom?.points.length) {
    drawPolyline(
      ctx,
      pendingRoom.points,
      "#2e7d32",
      pendingRoom.closed ? "rgba(46,125,50,0.18)" : "rgba(46,125,50,0.08)",
      2,
      {
        vertexHandles: pendingRoom.closed || pendingRoom.points.length >= 2,
        holes: pendingRoom.holes
      }
    );
    if (!pendingRoom.closed && pendingRoom.points.length >= 1) {
      ctx.strokeStyle = "#2e7d32";
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      const a = normToCanvas(pendingRoom.points[0]);
      ctx.moveTo(a.x, a.y);
      for (let i = 1; i < pendingRoom.points.length; i++) {
        const p = normToCanvas(pendingRoom.points[i]);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  if (calibrate?.points.length) {
    ctx.strokeStyle = "#1565c0";
    ctx.fillStyle = "#1565c0";
    ctx.lineWidth = 2;
    for (let i = 0; i < calibrate.points.length; i++) {
      const c = normToCanvas(calibrate.points[i]);
      ctx.beginPath();
      ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
      ctx.fill();
      if (i === 1) {
        const a = normToCanvas(calibrate.points[0]);
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
      const first = normToCanvas(pts[0]);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < pts.length; i++) {
        const p = normToCanvas(pts[i]);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      for (const pt of measure.points) {
        const c = normToCanvas(pt);
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
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const midX = (Math.min(...xs) + Math.max(...xs)) / 2 * canvasWidth - pdfScrollEl.clientWidth / 2;
  const midY = (Math.min(...ys) + Math.max(...ys)) / 2 * canvasHeight - pdfScrollEl.clientHeight / 2;
  pdfScrollEl.scrollTo({
    top: Math.max(0, midY),
    left: Math.max(0, midX),
    behavior: "auto"
  });
}
function endDiscovery(msg) {
  discovery = null;
  discoveryDockEl.classList.add("hidden");
  document.body.classList.remove("discovery-active");
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
      total === 0 ? "Discovery finished" : `Discovery finished \u2014 reviewed ${total} candidate(s)`
    );
    return;
  }
  discovery.current = ensureEditablePolyline(
    discovery.candidates[i].map((p) => ({ ...p })),
    16
  );
  discovery.candidates[i] = discovery.current;
  discovery.dragVertex = null;
  discoveryProgressEl.textContent = `(${i + 1} of ${total})`;
  discoveryHintEl.textContent = "Drag anchors to follow walls. Double-click an anchor to remove it, or Simplify to thin the polyline.";
  discoveryLabelInput.value = `${activePartNoun().singular.charAt(0).toUpperCase() + activePartNoun().singular.slice(1)} ${rooms.length + 1}`;
  discoveryDockEl.classList.remove("hidden");
  document.body.classList.add("discovery-active");
  updateMeasureReadouts();
  updateToolHint();
  drawOverlay();
  scrollToRing(discovery.current);
}
async function startDiscovery() {
  if (!cropBitmap || !activeSection) {
    setStatus(`Open a ${activePartNoun().title.toLowerCase()} first`, "err");
    return;
  }
  endCalibrate();
  clearPendingRoom();
  if (measure.tool !== "off") clearMeasure(false);
  discoverBtn.disabled = true;
  if (discoverBtnSide) discoverBtnSide.disabled = true;
  setStatus(`Discovering ${activePartNoun().plural}\u2026`, "busy");
  const sample = document.createElement("canvas");
  sample.width = cropBitmap.width;
  sample.height = cropBitmap.height;
  const sampleCtx = sample.getContext("2d", { willReadFrequently: true });
  if (!sampleCtx) {
    setStatus("Cannot read drawing image", "err");
    discoverBtn.disabled = false;
    if (discoverBtnSide) discoverBtnSide.disabled = false;
    return;
  }
  sampleCtx.drawImage(cropBitmap, 0, 0);
  const img = sampleCtx.getImageData(0, 0, sample.width, sample.height);
  let found = [];
  try {
    found = discoverRoomPolylines(img);
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Discovery failed", "err");
    discoverBtn.disabled = false;
    if (discoverBtnSide) discoverBtnSide.disabled = false;
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
    seeded ? "No auto rooms found \u2014 adjust the red starter outline to fit a room, then Accept" : `${norms.length} room candidate(s) \u2014 drag the red dashed outline to fit, then Accept / Skip`,
    seeded ? "busy" : "ok"
  );
  discoverBtn.disabled = false;
  if (discoverBtnSide) discoverBtnSide.disabled = false;
}
async function acceptDiscovery() {
  if (!discovery || !activeSection || !auth) return;
  const points = closeRing(discovery.current);
  const label = discoveryLabelInput.value.trim() || `${activePartNoun().singular.charAt(0).toUpperCase() + activePartNoun().singular.slice(1)} ${rooms.length + 1}`;
  const level = discoveryLevelSelect.value || "OTHER";
  if (isFloormapKind()) {
    let nums = parseVgVrInputs();
    if (nums.vg_nr == null || nums.vr_nr == null) {
      fillVgVrSuggestions();
      nums = parseVgVrInputs();
    }
    if (nums.error || nums.vg_nr == null || nums.vr_nr == null) {
      setStatus(nums.error || "Vul VG- en VR-nummer in (zijbalk) v\xF3\xF3r Accept", "err");
      return;
    }
    discoveryAcceptBtn.disabled = true;
    setStatus("Ruimte opslaan\u2026", "busy");
    try {
      const mpu = activeScaleMpu();
      await apiPost("/api/floormap/subsections", {
        section_id: activeSection.id,
        label,
        level_hint: level,
        vg_nr: nums.vg_nr,
        vr_nr: nums.vr_nr,
        points,
        metres_per_norm_unit: mpu ?? void 0,
        scale_aspect_yx: activeScaleAspect()
      });
      await loadRooms();
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
  discoveryAcceptBtn.disabled = true;
  setStatus("Component opslaan\u2026", "busy");
  try {
    const mpu = activeScaleMpu();
    await apiPost("/api/floormap/subsections", {
      section_id: activeSection.id,
      label,
      level_hint: level,
      points,
      metres_per_norm_unit: mpu ?? void 0,
      scale_aspect_yx: activeScaleAspect()
    });
    await loadRooms();
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
      setStatus("Need at least 3 anchors", "err");
      return false;
    }
    discovery.current = next;
    discovery.candidates[discovery.index] = next;
    discovery.dragVertex = null;
    updateMeasureReadouts();
    drawOverlay();
    setStatus(`Removed anchor (${ringVertexCount(next)} left)`, "ok");
    return true;
  }
  if (pendingRoom?.closed) {
    const next = removeRingVertex(pendingRoom.points, index);
    if (!next) {
      setStatus("Need at least 3 anchors", "err");
      return false;
    }
    pendingRoom.points = next;
    pendingRoom.dragVertex = null;
    syncPendingRoomButtons();
    updateMeasureReadouts();
    scheduleRoomListRefresh();
    drawOverlay();
    setStatus(`Removed anchor (${ringVertexCount(next)} left)`, "ok");
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
      after < before ? `Simplified ${before} \u2192 ${after} anchors` : "Outline already simple",
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
      after < before ? `Simplified ${before} \u2192 ${after} anchors` : "Outline already simple",
      "ok"
    );
  }
}
function nudgeCurrent(dx, dy) {
  if (discovery?.current) {
    discovery.current = translateRing(discovery.current, dx, dy);
    discovery.candidates[discovery.index] = closeRing(discovery.current);
    updateMeasureReadouts();
    drawOverlay();
    return;
  }
  if (pendingRoom?.closed) {
    pendingRoom.points = translateRing(pendingRoom.points, dx, dy);
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
  if (measure.tool !== "off") clearMeasure(false);
  if (calibrate) {
    endCalibrate("Calibration cancelled");
    return;
  }
  calibrate = { points: [] };
  calibrateMetresWrap.classList.add("hidden");
  calibrateHintEl.textContent = "Click both ends of a known length on the floormap.";
  calibrateBtn.textContent = "Cancel calibrate";
  setStatus("Click first scale point", "busy");
  drawOverlay();
}
function repickCalibrate() {
  if (!calibrate) return;
  calibrate = { points: [] };
  calibrateMetresWrap.classList.add("hidden");
  calibrateHintEl.textContent = "Click both ends of a known length on the floormap.";
  setStatus("Click first scale point", "busy");
  drawOverlay();
}
async function finishCalibrate() {
  if (!calibrate || calibrate.points.length < 2 || !activeSection) return;
  const mm = Number(calibrateMetresInput.value);
  if (!(mm > 0)) {
    setStatus("Enter a positive length in millimetres", "err");
    return;
  }
  const a = calibrate.points[0];
  const b = calibrate.points[1];
  const aspect = activeScaleAspect();
  const mpu = metresPerNormFromCalibration(mm / 1e3, a, b, aspect);
  if (!(mpu > 0) || !Number.isFinite(mpu)) {
    setStatus("Calibration points too close", "err");
    return;
  }
  try {
    await apiPost("/api/floormap/scale", {
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
    endCalibrate(`Scale saved: marked line = ${mm} mm`);
    updateMeasureReadouts();
    updateToolHint();
    await loadRooms();
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  }
}
async function deleteRoom(id) {
  try {
    await apiDelete(`/api/floormap/subsections?subsection_id=${encodeURIComponent(id)}`);
    if (pendingRoom?.editingId === id) clearPendingRoom();
    await loadRooms();
    setStatus("Room removed", "ok");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  }
}
async function moveRoom(index, delta) {
  if (!auth?.token || !activeSection) return;
  const j = index + delta;
  if (index < 0 || j < 0 || index >= rooms.length || j >= rooms.length) return;
  const prev = rooms.slice();
  const next = rooms.slice();
  const tmp = next[index];
  next[index] = next[j];
  next[j] = tmp;
  next.forEach((r, i) => {
    r.sort_order = i;
  });
  rooms = next;
  renderRoomList();
  drawOverlay();
  try {
    await apiPost("/api/floormap/subsections/reorder", {
      section_id: activeSection.id,
      ordered_ids: rooms.map((r) => r.id)
    });
    setStatus("Volgorde opgeslagen", "ok");
  } catch (err) {
    rooms = prev;
    renderRoomList();
    drawOverlay();
    setStatus(err instanceof Error ? err.message : String(err), "err");
    try {
      await loadRooms();
    } catch {
    }
  }
}
function hitVertex(norm, points, pxRadius = 8) {
  const thresh = pxRadius / Math.max(canvasWidth, 1);
  const n = points.length > 1 && Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y) < 1e-6 ? points.length - 1 : points.length;
  for (let i = 0; i < n; i++) {
    if (Math.hypot(points[i].x - norm.x, points[i].y - norm.y) <= thresh) return i;
  }
  return -1;
}
overlayCanvas.addEventListener("mousedown", (ev) => {
  const c = eventToCanvas(ev);
  const norm = canvasToNorm(c.x, c.y);
  if (calibrate) {
    if (calibrate.points.length >= 2) return;
    calibrate.points.push(norm);
    drawOverlay();
    if (calibrate.points.length === 1) {
      setStatus("Click second scale point", "busy");
      calibrateHintEl.textContent = "Click the other end of the known length.";
    } else if (calibrate.points.length >= 2) {
      calibrateMetresWrap.classList.remove("hidden");
      calibrateHintEl.textContent = "Enter the real length in millimetres, then Apply (or press Enter).";
      setStatus("Enter length in mm, then Apply", "ok");
      queueMicrotask(() => {
        calibrateMetresInput.focus();
        calibrateMetresInput.select();
      });
    }
    return;
  }
  if (pendingRoom?.drawing && !pendingRoom.closed) {
    if (pendingRoom.points.length >= 3) {
      const first = pendingRoom.points[0];
      if (Math.hypot(norm.x - first.x, norm.y - first.y) <= 10 / Math.max(canvasWidth, 1) || ev.detail === 2) {
        closePendingPolygon();
        return;
      }
    }
    pendingRoom.points.push(norm);
    syncPendingRoomButtons();
    updateMeasureReadouts();
    updateToolHint();
    drawOverlay();
    return;
  }
  if (pendingRoom?.closed) {
    const vi = hitVertex(norm, pendingRoom.points, 12);
    if (vi >= 0) {
      if (ev.detail === 2) {
        removeVertexFromActiveOutline(vi);
        return;
      }
      pendingRoom.dragVertex = vi;
      return;
    }
  }
  if (measure.tool === "length") {
    if (!activeScaleMpu()) {
      setStatus("Set scale first", "err");
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
    const vi = hitVertex(norm, discovery.current, 12);
    if (vi >= 0) {
      if (ev.detail === 2) {
        removeVertexFromActiveOutline(vi);
        return;
      }
      discovery.dragVertex = vi;
      return;
    }
  }
});
overlayCanvas.addEventListener("dblclick", (ev) => {
  ev.preventDefault();
});
overlayCanvas.addEventListener("mousemove", (ev) => {
  const c = eventToCanvas(ev);
  const norm = canvasToNorm(c.x, c.y);
  if (pendingRoom?.dragVertex != null) {
    const i2 = pendingRoom.dragVertex;
    pendingRoom.points[i2] = norm;
    if (i2 === 0 && pendingRoom.closed) {
      pendingRoom.points[pendingRoom.points.length - 1] = { ...norm };
    }
    updateMeasureReadouts();
    scheduleRoomListRefresh();
    drawOverlay();
    return;
  }
  if (measure.tool === "length" && measure.points.length < 2) {
    measure.cursor = norm;
    updateMeasureReadouts();
    drawOverlay();
    return;
  }
  if (!discovery || discovery.dragVertex == null) return;
  const i = discovery.dragVertex;
  discovery.current[i] = norm;
  if (i === 0) discovery.current[discovery.current.length - 1] = { ...norm };
  discovery.candidates[discovery.index] = closeRing(discovery.current);
  updateMeasureReadouts();
  drawOverlay();
});
overlayCanvas.addEventListener("mouseup", () => {
  if (discovery) {
    if (discovery.dragVertex != null) {
      discovery.candidates[discovery.index] = closeRing(discovery.current);
      discovery.dragVertex = null;
      updateMeasureReadouts();
      drawOverlay();
    }
    return;
  }
  if (pendingRoom?.dragVertex != null) {
    pendingRoom.dragVertex = null;
    updateMeasureReadouts();
    scheduleRoomListRefresh();
    drawOverlay();
  }
});
overlayCanvas.addEventListener("mouseleave", () => {
  if (discovery) discovery.dragVertex = null;
  if (pendingRoom) pendingRoom.dragVertex = null;
});
loginForm.addEventListener("submit", (ev) => {
  ev.preventDefault();
  const fd = new FormData(loginForm);
  const username = String(fd.get("username") || "");
  const password = String(fd.get("password") || "");
  void (async () => {
    try {
      setStatus("Signing in\u2026", "busy");
      await bootstrapAndLogin(username, password);
      setStatus("Signed in", "ok");
      if (buildingId) await loadFloormapSections(buildingId);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err), "err");
      showLogin();
    }
  })();
});
logoutBtn.addEventListener("click", () => {
  showLogin();
  setStatus("Signed out", "ok");
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
materialEigenOnlyEl?.addEventListener("change", () => {
  syncEigenOnlyFilterUi();
  if (!materialEigenOnlyEl.checked && materialFilterEl?.value.trim()) {
    materialFilterEl.value = "";
  }
  void loadMaterialsForCategory(
    (materialCategoryEl?.value || "").trim(),
    (materialFilterEl?.value || "").trim()
  );
});
function syncEigenOnlyFilterUi() {
  const on = Boolean(materialEigenOnlyEl?.checked);
  materialEigenFilterLabelEl?.classList.toggle("is-on", on);
  if (materialEigenFilterStateEl) materialEigenFilterStateEl.textContent = on ? "aan" : "uit";
  if (materialEigenOnlyEl) {
    materialEigenOnlyEl.setAttribute("aria-checked", on ? "true" : "false");
  }
}
materialIdEl?.addEventListener("change", () => {
  syncPendingRoomButtons();
  updateMaterialQuantityHint();
  updateMaterialSpectrumPreview();
});
function openMaterialCatalogEditor() {
  const mat = selectedCatalogMaterial();
  const matUrl = new URL("/materials.html", location.origin);
  if (mat?.material_id) matUrl.searchParams.set("material_id", mat.material_id);
  if (mat?.catalog_id) matUrl.searchParams.set("q", mat.catalog_id);
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
        drawing: !closed && Boolean(draft.pending.drawing)
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
  if (pick?.material_id && pick.master_category && !isFloormapKind()) {
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
function setCustomMatPanelOpen(open) {
  if (!customMatPanelEl) return;
  customMatPanelEl.classList.toggle("hidden", !open);
  if (open) void ensureCustomMatRubrieken();
}
async function ensureCustomMatRubrieken() {
  if (!customMatRubriekEl || !auth) return;
  await ensureMaterialCategories();
  if (customMatRubriekEl.options.length > 1) return;
  customMatRubriekEl.replaceChildren();
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = "\u2014 kies rubriek \u2014";
  customMatRubriekEl.appendChild(ph);
  for (const c of materialCategoryMeta) {
    if (c.rubriek_nr == null) continue;
    const o = document.createElement("option");
    o.value = String(c.rubriek_nr);
    o.textContent = c.label || c.master_category;
    customMatRubriekEl.appendChild(o);
  }
  const current = materialCategoryMeta.find((c) => c.master_category === (materialCategoryEl?.value || "").trim());
  if (current?.rubriek_nr != null) customMatRubriekEl.value = String(current.rubriek_nr);
}
openMatCatalogBtn?.addEventListener("click", () => {
  openMaterialCatalogEditor();
});
customMatToggleBtn?.addEventListener("click", () => {
  setCustomMatPanelOpen(true);
  if (customMatNameEl && !customMatNameEl.value.trim()) {
    customMatNameEl.value = (roomLabelInput?.value || "").trim();
  }
});
customMatCancelBtn?.addEventListener("click", () => {
  setCustomMatPanelOpen(false);
});
customMatForm?.addEventListener("submit", (ev) => {
  ev.preventDefault();
  void (async () => {
    if (!auth?.token) throw new Error("Niet ingelogd");
    const rubriek = Number(customMatRubriekEl?.value || "");
    const name = (customMatNameEl?.value || "").trim();
    const ra = Number(customMatRaEl?.value);
    if (!Number.isInteger(rubriek) || rubriek < 1) throw new Error("Kies een rubriek");
    if (!name) throw new Error("Naam is verplicht");
    if (!Number.isFinite(ra) || ra < 0 || ra > 100) throw new Error("RA moet tussen 0 en 100 liggen");
    const subsectionId = pendingRoom?.editingId || "";
    setStatus("Eigen materiaal opslaan\u2026", "busy");
    const data = await apiPost("/api/floormap/materials", {
      name,
      ra_dba: ra,
      rubriek_nr: rubriek,
      subsection_id: subsectionId || void 0
    });
    const master = data.material.master_category || materialCategoryMeta.find((c) => c.rubriek_nr === rubriek)?.master_category || "";
    await ensureMaterialCategories();
    if (materialCategoryEl && master) {
      if (![...materialCategoryEl.options].some((o) => o.value === master)) {
        const opt = document.createElement("option");
        opt.value = master;
        opt.textContent = master;
        materialCategoryEl.appendChild(opt);
      }
      materialCategoryEl.value = master;
      renderMaterialSubcategoryOptions();
    }
    if (materialEigenOnlyEl) {
      materialEigenOnlyEl.checked = false;
      syncEigenOnlyFilterUi();
    }
    if (materialFilterEl) materialFilterEl.value = "";
    await loadMaterialsForCategory(master, "");
    if (materialIdEl) {
      if (![...materialIdEl.options].some((o) => o.value === data.material.material_id)) {
        const opt = document.createElement("option");
        opt.value = data.material.material_id;
        opt.textContent = `${data.material.catalog_id} \xB7 ${data.material.name} \xB7 eigen`;
        materialIdEl.appendChild(opt);
        if (!catalogMaterials.some((m) => m.material_id === data.material.material_id)) {
          catalogMaterials.push({
            material_id: data.material.material_id,
            catalog_id: data.material.catalog_id,
            material_no: 0,
            master_category: master,
            name: data.material.name,
            category: "",
            thickness_mm: null,
            ra_dba: data.material.ra_dba
          });
        }
      }
      materialIdEl.value = data.material.material_id;
      materialIdEl.disabled = false;
    }
    updateMaterialSpectrumPreview();
    syncPendingRoomButtons();
    setCustomMatPanelOpen(false);
    if (customMatNameEl) customMatNameEl.value = "";
    if (data.assigned && subsectionId) {
      await loadRooms();
      setStatus(`Materiaal \xAB${data.material.name}\xBB opgeslagen en gekoppeld aan component`, "ok");
    } else {
      setStatus(
        `Materiaal \xAB${data.material.name}\xBB opgeslagen \u2014 kies Component opslaan om te koppelen`,
        "ok"
      );
    }
  })().catch((err) => setStatus(err instanceof Error ? err.message : String(err), "err"));
});
function updateMaterialQuantityHint() {
  const hint = materialBlockEl?.querySelector(".hint:last-of-type") || materialBlockEl?.querySelector(".hint");
  if (!(hint instanceof HTMLElement)) return;
  if (selectedIsKierdichting()) {
    hint.textContent = "Rubriek 9 (kierdichting): lengte in meters wordt opgeslagen (pad \u22652 punten of gesloten omtrek). Geen oppervlakte.";
  } else {
    hint.textContent = "Kies rubriek + subrubriek en een catalogusmateriaal, of maak een eigen materiaal. Nodig voor de berekening gevelwering per VR.";
  }
}
backPickerBtn.addEventListener("click", () => {
  endDiscovery();
  endCalibrate();
  clearMeasure(false);
  selectedSetIds.clear();
  constituentSigns.clear();
  booleanPreview = null;
  workspacePanelEl.classList.add("hidden");
  pickerPanelEl.classList.remove("hidden");
  activeSection = null;
  renderSectionList();
});
zoomOutBtn.addEventListener("click", () => void setViewZoom(viewZoom - ZOOM_STEP));
zoomInBtn.addEventListener("click", () => void setViewZoom(viewZoom + ZOOM_STEP));
zoomBtn.addEventListener("click", () => void setViewZoom(1));
zoomFitBtn.addEventListener("click", () => void zoomToFit());
discoverBtn.addEventListener("click", () => void startDiscovery());
discoverBtnSide?.addEventListener("click", () => void startDiscovery());
calibrateBtn.addEventListener("click", () => startCalibrate());
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
roomClearBtn.addEventListener("click", () => {
  clearPendingRoom();
  setStatus("Room mark cleared", "ok");
});
document.querySelectorAll(".tool-mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    setMeasureTool(btn.dataset.tool || "off");
  });
});
toolClearBtn?.addEventListener("click", () => {
  if (pendingRoom) {
    clearPendingRoom();
    setStatus("Room mark cleared", "ok");
    return;
  }
  clearMeasure(true);
  setStatus("Measure cleared", "ok");
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
window.addEventListener("keydown", (evt) => {
  if (evt.key !== "Escape") return;
  if (pendingRoom) {
    clearPendingRoom();
    setStatus("Room mark cleared", "ok");
  } else if (measure.tool !== "off") {
    clearMeasure(true);
    setStatus("Measure cleared", "ok");
  }
});
discoveryAcceptBtn.addEventListener("click", () => void acceptDiscovery());
discoverySkipBtn.addEventListener("click", () => skipDiscovery());
discoveryCancelBtn.addEventListener("click", () => endDiscovery("Discovery cancelled"));
discoverySimplifyBtn?.addEventListener("click", () => simplifyActiveOutline());
nudgeLeftBtn.addEventListener("click", () => nudgeCurrent(-0.01, 0));
nudgeRightBtn.addEventListener("click", () => nudgeCurrent(0.01, 0));
nudgeUpBtn.addEventListener("click", () => nudgeCurrent(0, -0.01));
nudgeDownBtn.addEventListener("click", () => nudgeCurrent(0, 0.01));
syncPendingRoomButtons();
syncEigenOnlyFilterUi();
function connect() {
  setStatus("Connecting\u2026", "busy");
  setConnLed(false);
  ws = new WebSocket(BPP_WS);
  ws.addEventListener("open", () => {
    setConnLed(true);
    void (async () => {
      try {
        await send("session.open", { client: "app-gevelwering-floormap" }, "session.opened");
        const stored = loadStoredAuth();
        if (stored?.token) {
          await loadSharedApi();
          const ret = await invokeString("API_ValidateSession", [stored.token]);
          if (ret.startsWith("ERROR")) {
            showLogin();
            setStatus("Session expired \u2014 sign in", "err");
            return;
          }
          showPanel(stored);
          setStatus("Ready", "ok");
          buildingInput.value = buildingId;
          if (buildingId) await loadFloormapSections(buildingId);
        } else {
          showLogin();
          setStatus("Connected \u2014 sign in", "ok");
        }
      } catch (err) {
        setStatus(err instanceof Error ? err.message : String(err), "err");
        showLogin();
      }
    })();
  });
  ws.addEventListener("message", (ev) => onMessage(String(ev.data)));
  ws.addEventListener("close", () => {
    setConnLed(false);
    setStatus("Disconnected", "err");
  });
  ws.addEventListener("error", () => setStatus("WebSocket error", "err"));
}
buildingInput.value = buildingId;
initPasswordToggles();
initEngineerLayoutSplit();
connect();
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
