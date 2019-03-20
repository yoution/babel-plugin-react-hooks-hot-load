# babel-plugin-react-hooks-hot-load
babel plugin for react hooks hot load

## Installing 
```
npm install babel-plugin-react-hooks-hot-load
```

## Usage
put before metro-babel7-plugin-react-transform
```
{
  "plugins": [
    "babel-plugin-react-hooks-hot-load",
    require.resolve("metro-babel7-plugin-react-transform"),
    {
      transforms: [
        {
          transform: "react-transform-hmr",
          imports: ["react"],
          locals: ["module"]
        }
      ]
    }
  ]
}
```

