//import { types as tt } from "../tokenizer/types";
//import Parser from "../parser";

// let pp = Parser.prototype;
//
// pp.flowParseTypeInitialiser = function (tok) {
//   let oldInType = this.state.inType;
//   this.state.inType = true;
//   this.expect(tok || tt.colon);
//
//   let type = this.flowParseType();
//   this.state.inType = oldInType;
//   return type;
// };

export default function (instance) {
  instance.extend("parseClassMethod", function () {
    return function (classBody, method, isGenerator, isAsync) {
      const functionDefinition = this.parseMethod(this.startNode(), isGenerator, isAsync);

      method.value = this.finishNode(functionDefinition, "FunctionExpression");
      classBody.body.push(this.finishNode(method, "MethodDefinition"));
    };
  });
}
