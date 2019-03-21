module.exports = function(ref) {
  const t = ref.types;
  const { template } = ref;

  const componentVisitor = {
    ExportDefaultDeclaration(path) {
      this.visitorData.exportPath = path;
    },

    JSXElement(path) {
      if (path.parent.type === "ReturnStatement") {
        if (path.parentPath.parentPath.parent.type === "FunctionDeclaration") {
          const { name } = path.parentPath.parentPath.parent.id;
          this.visitorData.hookName.push(name);
        }
      }
    }
  };

  class ReactTransformBuilder {
    constructor(file, options) {
      this.file = file;
      this.options = options;
      this.visitorData = { hookName: [], exportPath: null };
    }
    travelPath() {
      this.file.path.traverse(componentVisitor, {
        visitorData: this.visitorData
      });
    }
    hasHook() {
      const name = this.getModuleName();
      return this.visitorData.hookName.some(hookName => hookName === name);
    }
    getModuleName() {
      return this.visitorData.exportPath
        ? this.visitorData.exportPath.node.declaration.name
        : "";
    }
    build() {
      this.travelPath();
      if (this.hasHook()) {
        this.addWrapInstance();
        this.changeModuleName();
      }
    }
    addWrapInstance() {
      const wrapperFunctionTemplate = template(
        `
        class CLASS_NAME_WRAP extends React.Component {
          render() {
            return (<CLASS_NAME {...this.props}/>);
          }
        }
        CLASS_NAME_WRAP.displayName = 'DISPLAY_NAME'
        `,
        {
          plugins: ["jsx"]
        }
      );
      const moduleNamme = this.getModuleName();
      const wrapInstance = wrapperFunctionTemplate({
        CLASS_NAME_WRAP: `${moduleName}HMRWrapper`,
        DISPLAY_NAME: `hmr(${moduleName})`,
        CLASS_NAME: t.JSXIdentifier(moduleNamme)
      });
      this.visitorData.exportPath.insertBefore(wrapInstance);
    }
    changeModuleName() {
      this.visitorData.exportPath.node.declaration.name = `${this.getModuleName()}HMRWrapper`;
    }
  }
  return {
    visitor: {
      Program(path, state) {
        const { file, opts } = state;
        const builder = new ReactTransformBuilder(file, opts);

        builder.build();
      }
    }
  };
};
