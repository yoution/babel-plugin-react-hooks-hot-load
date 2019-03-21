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
    },

    MemberExpression(path) {
      if (path.node.property && path.node.property.name === "forwardRef") {
        if (path.parentPath.parent.id) {
          this.visitorData.hookName.push(path.parentPath.parent.id.name);
          this.visitorData.refName = path.parentPath.parent.id.name;
        }
      }
    }
  };

  class ReactTransformBuilder {
    constructor(file, options) {
      this.file = file;
      this.options = options;
      this.visitorData = { hookName: [], exportPath: null, refName: null };
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
    isNeedRef() {
      return this.visitorData.refName === this.getModuleName();
    }
    getModuleName() {
      return this.visitorData.exportPath
        ? this.visitorData.exportPath.node.declaration.name
        : "";
    }
    build() {
      this.travelPath();
      if (this.hasHook()) {
        if (this.isNeedRef()) {
          this.addWrapRefInstance();
        } else {
          this.addWrapInstance();
        }
        this.changeModuleName();
      }
    }
    addWrapRefInstance() {
      const wrapperFunctionTemplate = template(
        `
        class CLASS_NAME_WRAP extends React.Component {
          render() {
            return (<CLASS_NAME {...this.props} ref={this.props.hmrRef}/>);
          }
        }
        CLASS_NAME_WRAP.displayName = 'DISPLAY_NAME'
        let CLASS_NAME_REF = React.forwardRef((props, ref) => {
          return <CLASS_NAME_WRAP_TAG {...props} hmrRef={ref}/>
        })
      `,
        {
          plugins: ["jsx"]
        }
      );
      const moduleName = this.getModuleName();
      const wrapInstance = wrapperFunctionTemplate({
        CLASS_NAME_WRAP: `${moduleName}HMRWrapper`,
        CLASS_NAME_WRAP_TAG: t.JSXIdentifier(`${moduleName}HMRWrapper`),
        CLASS_NAME_REF: `${moduleName}HMRREFWrapper`,
        DISPLAY_NAME: `hmr(${moduleName})`,
        CLASS_NAME: t.JSXIdentifier(moduleName)
      });
      this.visitorData.exportPath.insertBefore(wrapInstance);
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
      const moduleName = this.getModuleName();
      const wrapInstance = wrapperFunctionTemplate({
        CLASS_NAME_WRAP: `${moduleName}HMRWrapper`,
        DISPLAY_NAME: `hmr(${moduleName})`,
        CLASS_NAME: t.JSXIdentifier(moduleName)
      });
      this.visitorData.exportPath.insertBefore(wrapInstance);
    }
    changeModuleName() {
      let tailName = "HMRWrapper";
      if (this.isNeedRef()) {
        tailName = "HMRREFWrapper";
      }
      this.visitorData.exportPath.node.declaration.name = `${this.getModuleName()}${tailName}`;
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
