import { types as tt } from "../tokenizer/types";
import Parser from "../parser";

let pp = Parser.prototype;

pp.estreeParseRegExpLiteral = function ({ pattern, flags }) {
  let regex = null;
  try {
    regex = new RegExp(pattern, flags);
  } catch (e) {
    // In environments that don't support these flags value will
    // be null as the regex can't be represented natively.
  }
  let node = this.estreeParseLiteral(regex);
  node.regex = { pattern, flags };

  return node;
};

pp.estreeParseLiteral = function (value) {
  const node = this.parseLiteral(value, "Literal");
  node.raw = node.extra.raw;
  delete node.extra;

  return node;
};

export default function (instance) {
  instance.extend("isValidDirective", function () {
    return function () {
      return false;
    };
  });

  instance.extend("parseClassMethod", function () {
    return function (classBody, method, isGenerator, isAsync) {
      const functionDefinition = this.parseMethod(this.startNode(), isGenerator, isAsync);

      method.value = this.finishNode(functionDefinition, "FunctionExpression");
      classBody.body.push(this.finishNode(method, "MethodDefinition"));
    };
  });

  instance.extend("parseExprAtom", function(inner) {
    return function (refShorthandDefaultPos) {
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
          inner.call(this, refShorthandDefaultPos);
      }
    };
  });
}
