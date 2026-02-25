const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");

const config = getDefaultConfig(__dirname);

// 应用 rork-ai 的 Metro 修改
const rorkConfig = withRorkMetro(config);

// 配置 SVG transformer
rorkConfig.transformer = {
    ...rorkConfig.transformer,
    babelTransformerPath: require.resolve("react-native-svg-transformer")
};

// 修改 resolver
rorkConfig.resolver = {
    ...rorkConfig.resolver,
    assetExts: rorkConfig.resolver.assetExts.filter(ext => ext !== "svg"),
    sourceExts: [...rorkConfig.resolver.sourceExts, "svg"]
};

module.exports = rorkConfig;