# 截屏分析

适用于 Windows x64 版 Maimai Times Tech。框选屏幕区域、添加标注后，图片会进入当前对话草稿，可补充问题再发送。

## 安装与使用

1. 使用已移除内置截屏功能的桌面版本。若已自行安装原版截屏插件，请先在插件广场卸载原版，以免重复注册快捷键。
2. 在插件广场点击「添加插件」，输入 `github:wuhe888/dsh-plugin-live-shot-custom#v0.7.0-custom.2`，安装完成后重启桌面应用。
3. 在侧栏打开「截屏设置」，可选择隐藏桌面应用、设置截图快捷键或启用本次运行的管理员游戏兼容。管理员兼容需要 Windows 确认。
4. 点击输入框的「截屏分析」或按 Ctrl+Shift+X（默认），框选、标注并确认。按 Esc 可取消。

输入框按钮的名称和快捷键提示跟随应用语言即时切换。英文显示为 “Screenshot analysis”，也支持日语、德语、西班牙语、法语、葡萄牙语和俄语。

在插件广场卸载并重启可移除入口和全局快捷键。插件沿用 DSH_HOME/desktop/screenshot 下的偏好设置。首次运行从本机桌面应用准备 Electron 辅助进程。

## 许可

本项目基于 TangerineSplendor 的 [dsh-plugin-live-shot 0.7.0-beta.6](https://github.com/TangerineSplendor/dsh-plugin-live-shot)，沿用 [MIT 许可证](LICENSE)。定制版整合了独立设置页、截屏分析按钮、选框置顶和中文错误信息修复。

## 开发验证

准备好已安装依赖的 DeepSeek Harness 源码后，运行 `node tests/run.mjs <Harness 源码目录>`。测试覆盖侧栏设置页、输入框按钮、卸载清理、原生选框置顶和 UTF-8 错误信息。
