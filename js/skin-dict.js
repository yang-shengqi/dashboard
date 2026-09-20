/* ============================================================
 * skin-dict.js —— 皮肤清单（纯数据）
 * ------------------------------------------------------------
 * 规则：
 *   1. 只放皮肤 ID 和显示名，绝不放颜色值
 *   2. 颜色值在 tokens.css 里以 [data-skin="id"] 定义
 *   3. 加新皮肤：这里加一项 + tokens.css 加一段
 *
 * 本版修改：无（保留原样）
 * ============================================================ */
(function (App) {
  'use strict';

  App.skinDict = [
    { id: 'default', name: { zh: '默认', en: 'Default' } },
    { id: 'warm',    name: { zh: '暖阳', en: 'Warm'    } },
    { id: 'ocean',   name: { zh: '深海', en: 'Ocean'   } },
    { id: 'forest',  name: { zh: '森林', en: 'Forest'  } }
  ];

})(window.App = window.App || {});