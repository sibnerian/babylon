import { types as tt } from "../tokenizer/types";
import Parser from "../parser";

const pp = Parser.prototype;

pp.estreeParseRegExpLiteral = function ({ pattern, flags }) {
  let regex = null;
  try {
    regex = new RegExp(pattern, flags);
  } catch (e) {
    // In environments that don't support these flags value will
    // be null as the regex can't be represented natively.
  }
  const node = this.estreeParseLiteral(regex);
  node.regex = { pattern, flags };

  return node;
};

pp.estreeParseLiteral = function (value) {
  const node = this.parseLiteral(value, "Literal");
  node.raw = node.extra.raw;
  delete node.extra;

  return node;
};

function isSimpleProperty(node) {
  return node &&
    node.type === "Property" &&
    node.kind === "init" &&
    node.method === false;
}

export default function (instance) {
  instance.extend("checkDeclaration", function(inner) {
    return function (node) {
      if (isSimpleProperty(node)) {
        this.checkDeclaration(node.value);
      } else {
        inner.call(this, node);
      }
    };
  });

  instance.extend("checkLVal", function(inner) {
    return function (expr, isBinding, checkClashes, ...args) {
      switch (expr.type) {
        case "ObjectPattern":
          for (const prop of (expr.properties: Array<Object>)) {
            this.checkLVal(prop.value, isBinding, checkClashes, "object destructuring pattern");
          }
          break;
        default:
          inner.call(this, expr, isBinding, checkClashes, ...args);
      }
    };
  });

  instance.extend("checkPropClash", function () {
    return function (prop, propHash) {
      if (prop.computed || !isSimpleProperty(prop)) return;

      const key = prop.key;
      // It is either an Identifier or a String/NumericLiteral
      const name = key.type === "Identifier" ? key.name : String(key.value);

      if (name === "__proto__") {
        if (propHash.proto) this.raise(key.start, "Redefinition of __proto__ property");
        propHash.proto = true;
      }
    };
  });

  instance.extend("isValidDirective", function () {
    return function () {
      return false;
    };
  });

  instance.extend("parseClassMethod", function (inner) {
    return function (classBody, ...args) {
      inner.call(this, classBody, ...args);

      const body = classBody.body;
      body[body.length - 1].type = "MethodDefinition";
    };
  });

  instance.extend("parseExprAtom", function(inner) {
    return function (...args) {
      switch (this.state.type) {
        case tt.regexp:
          return this.estreeParseRegExpLiteral(this.state.value);

        case tt.num:
        case tt.string:
          return this.estreeParseLiteral(this.state.value);

        case tt._null:
          return this.estreeParseLiteral(null);

        case tt._true:
          return this.estreeParseLiteral(true);

        case tt._false:
          return this.estreeParseLiteral(false);

        default:
          return inner.call(this, ...args);
      }
    };
  });

  instance.extend("parseMethod", function(inner) {
    return function (node, ...args) {
      const value = inner.call(this, this.startNode(), ...args);
      node.value = this.finishNode(value, "FunctionExpression");

      return node;
    };
  });

  instance.extend("parseObjectMethod", function(inner) {
    return function (...args) {
      const node = inner.call(this, ...args);

      if (node) {
        if (node.kind === "method") node.kind = "init";
        node.type = "Property";
      }

      return node;
    };
  });

  instance.extend("parseObjectProperty", function(inner) {
    return function (...args) {
      const node = inner.call(this, ...args);

      if (node) {
        node.kind = "init";
        node.type = "Property";
      }

      return node;
    };
  });

  instance.extend("toAssignable", function(inner) {
    return function (node, isBinding, ...args) {
      if (isSimpleProperty(node)) {
        this.toAssignable(node.value, isBinding, ...args);

        return node;
      } else if (node.type === "ObjectExpression") {
        node.type = "ObjectPattern";
        for (const prop of (node.properties: Array<Object>)) {
          if (prop.kind === "get" || prop.kind === "set") {
            this.raise(prop.key.start, "Object pattern can't contain getter or setter");
          } else if (prop.method) {
            this.raise(prop.key.start, "Object pattern can't contain methods");
          } else {
            this.toAssignable(prop, isBinding, "object destructuring pattern");
          }
        }

        return node;
      }

      return inner.call(this, node, isBinding, ...args);
    };
  });
}
