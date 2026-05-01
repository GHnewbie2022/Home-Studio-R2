# 針對混音室空間設計之高階光線追蹤與降噪技術評估報告：以光照設備採購為導向

## 第一章：導論與數位孿生場景之光學物理需求分析

在當代高階室內設計與數位孿生（Digital Twin）領域中，專業混音室（Mixing Room）的空間建構對渲染技術提出了極為嚴苛且特殊的物理要求。有別於一般商業空間或住宅設計，混音室的幾何特徵與表面材質包含了大量複雜的光學散射與吸收介面。

具體而言，牆面與天花板通常佈滿了深度不一的聲學擴散體（Acoustic Diffusers），這些幾何結構在光線追蹤管線中會引發極高頻率的多次光線反彈；同時，空間中大量使用的吸音棉、特製隔音布料與低反照率（Low Albedo）塗料，會大幅度吸收光能，導致追蹤光線（Ray）在漫射過程中存活率極低。此外，混音台上的各類監聽設備、金屬旋鈕與大型隔音玻璃窗，則構成了高度複雜的雙向散射分佈函數（Bidirectional Scattering Distribution Function, BSDF），涵蓋了從金屬微表面反射到介電質（Dielectric）折射與焦散（Caustics）的各類光學現象。

當前開發流程中，透過 VIBE CODING（基於大型語言模型的 AI 驅動開發）結合 erichlof 框架打造的 3D 渲染系統，雖然已經成功實作了基礎的 Shader 計算與純軟體驅動的路徑追蹤（Path Tracing）技術，但在推進至「光照設備採購評估」這一終極商業目標時，遇到了難以跨越的技術瓶頸。評估高價值實體光照設備（如錄音室專用之無頻閃防眩光投射燈、洗牆燈或氣氛燈條），需要精確預測燈具的光度學分佈（Photometric Distribution）、色溫衰減、以及其在複雜聲學幾何體上所產生的全局光照（Global Illumination, GI）表現。若渲染引擎無法提供物理上絕對精確的輻照度（Irradiance）數據，或是在計算過程中產生無法消除的高頻雜訊（Fireflies），將導致決策者無法準確判斷燈光是否會對混音台螢幕造成眩光干擾，抑或是燈具的實際照度是否符合錄音室的工作標準。

本報告旨在針對上述挑戰，提供一份詳盡且具備深度的技術演進與架構評估。我們將深入剖析現行 WebGL 架構在蒙地卡羅積分（Monte Carlo Integration）與降噪收斂上的根本性限制，並全面性地評估四大前沿替代方案：包含基於硬體加速的 Apple Metal 原生光線追蹤管線、引領網頁圖形革命的 Three.js r184 WebGPU 更新（涵蓋螢幕空間全局光照 SSGI 與光探針網格 LightProbeGrid）、專注於網頁端純路徑追蹤的 LGL Tracer v3 與其時空降噪演算法，以及被視為工業界標準、整合了模型上下文協定（Model Context Protocol, MCP）與多智慧體（Multi-Agent）系統的 Blender 自動化驗證管線。

透過嚴謹的交叉對比與底層演算法解析，本報告將構建出一套能有效加速光照收斂、實現無雜訊真實渲染，並能準確指導光照設備採購的全面性技術藍圖。

## 第二章：現行架構剖析與 WebGL 路徑追蹤之效能瓶頸

`erichlof/THREE.js-PathTracing-Renderer` 是一個建構於 WebGL 框架之上，具有圖形學開創性意義的即時漸進式（Progressive）路徑追蹤引擎。該框架透過純 Shader 語言，在瀏覽器端實現了真實反射、折射、全局光照與軟陰影等高階物理現象。然而，當應用場景升級至混音室級別的高精度聲學與光學需求時，該架構暴露出了多個運算學與系統架構上的根本性瓶頸。

### 2.1 蒙地卡羅積分與時間累積機制的侷限性

在 erichlof 框架中，光線追蹤方程式的求解主要依賴蒙地卡羅積分與時間累積（Temporal Accumulation）技術來逐步降低影像的變異數（Variance）。然而，在混音室這種充滿暗色調吸音材質與複雜幾何散射體的場景中，光線存活與有效擊中光源的機率極低。這意味著單一像素需要發射成千上萬條路徑（Paths），才能在統計學上逼近真實的輻照度期望值。

這種完全依賴硬體暴力發射光線的速度來累積樣本的機制，存在一個致命的可用性缺陷：一旦使用者透過 VIBE CODING 指令移動相機、調整混音台位置或改變燈光參數，累積緩衝區（Accumulation Buffer）就必須被強制重置。在重置的瞬間，畫面會立刻退化為充滿高頻雜訊的未收斂狀態。對於需要反覆比較不同燈具照射角度與光斑分佈的採購評估工作流程而言，這種「操作即破壞收斂」的特性，極大地拖慢了設計迭代的效率。

### 2.2 幾何複雜度與單執行緒架構的記憶體危機

混音室的聲學擴散體通常由大量經過精密計算的木製凸起物或陣列構成，這導致場景的多邊形數量呈指數級增長。WebGL 的單執行緒特性與瀏覽器沙盒的記憶體限制，使得在此架構下處理高解析度幾何體變得極度困難。根據測試，當 erichlof 引擎嘗試處理複雜網格時，即使是極少量的多邊形增加，也會導致幀率發生斷崖式下降。

更為嚴重的是，WebGL 在處理動態場景時的記憶體管理缺陷。傳統的 WebGL 渲染管線在渲染大量網格時，會產生巨大的 CPU 開銷。例如，在未經極端優化的情況下，渲染 1,000 個網格並維持 60fps 幀率，可能會在每秒內生成 240,000 至高達 500,000 個以上的不必要物件，這會瞬間使 JavaScript 的垃圾回收機制（Garbage Collector）超載，引發嚴重的畫面卡頓（Stuttering）。在此種效能極限下，若還要強行計算複雜光源的物理路徑，將導致 VIBE CODING 開發環境的崩潰，無法支撐專業級的設備採購模擬。

### 2.3 現代化機器學習降噪器之匱乏

當前圖形學界解決路徑追蹤收斂緩慢的標準做法，是導入基於深度學習的神經網路降噪器（Neural Network Denoisers），如 NVIDIA OptiX 或 Intel OIDN。這些模型經過數百萬張離線渲染影像的訓練，能夠在極低樣本數（例如 4 到 16 SPP）的情況下，完美重建場景的物理特徵並消除雜訊。

然而，受限於 WebGL 較為陳舊的 API 規範與缺乏高階通用計算（GPGPU）的直接支援，erichlof 框架難以原生且高效地整合這些現代化的機器學習過濾器。這使得其「降噪收斂速率」完全被鎖死在物理光線發射的硬體極限上，成為評估高精度光照分佈時無法逾越的鴻溝。

## 第三章：硬體光線追蹤與 Apple Metal 架構之深度整合

若目標開發平台或終端設計團隊的硬體生態主要集中於 macOS 系統（特別是搭載專用硬體光追單元的 M3 及其後續 Apple Silicon 晶片），直接將渲染管線轉向 Apple Metal API 將能顯著突破上述的收斂與效能瓶頸。

### 3.1 MPSRayIntersector 與底層硬體加速結構

在諸如 codetiger/MetalRayTracing 與 dariopagliaricci/Metal-PathTracer-arm64 等專案中，展現了 Metal 框架在光線追蹤運算上的強大硬體耦合優勢。Metal Performance Shaders (MPS) 提供的 MPSRayIntersector 類別，能夠直接調用 Apple Silicon 內建的光線追蹤硬體單元。在處理混音室中密集的聲學擴散板與吸音結構時，演算法效能的核心在於光線與三角形相交測試（Ray-Triangle Intersection）的吞吐量。

Metal 架構要求開發者預先構建稱為加速結構（Acceleration Structure）的記憶體配置，包含頂層加速結構（Top-Level Acceleration Structure, TLAS）與底層加速結構（Bottom-Level Acceleration Structure, BLAS）。硬體加速單元能夠以極高的效率遍歷這些加速結構，將原本在 WebGL 中需要耗費大量 Shader 週期的遍歷運算，卸載至專用矽晶片上，從而達成每秒數千萬次乃至上億次的光線相交測試。此外，這些專案還實作了流形下一個事件估計（Manifold Next Event Estimation, MNEE）技術，專門用於精確求解混音室隔音玻璃等介電質所產生的複雜焦散（Caustics）效應，這在傳統純軟體路徑追蹤中是極難收斂的。

### 3.2 Intel OIDN 於 Apple Silicon 的深度集成與 AOV 輔助

Metal 架構在降噪領域的一大突破，在於其能夠無縫整合工業級的機器學習降噪器。在 Metal-PathTracer-arm64 專案中，開發者成功將 Intel® Open Image Denoise (OIDN) 2.3.3 版本編譯為專屬於 arm64 架構的動態函式庫（dylibs），並將其深度嵌入至渲染管線的後處理階段。

為確保神經網路能夠準確區分幾何邊緣、紋理細節與隨機雜訊，該 Metal 實作並非單純地將帶有雜訊的 RGB 影像輸入模型，而是配置了任意輸出變數（Arbitrary Output Variables, AOVs）路徑。這包含了反照率（Albedo）與表面法線（Normal）緩衝區，更重要的是，它支援了樣本計數通道（Sample-Count Channel）。透過提供特定像素的收斂程度作為上下文，OIDN 模型能夠動態調整其濾波權重。在混音室這種充滿低光與高動態範圍（HDR）對比的環境中，原本需要 1024 SPP 才能穩定收斂的暗部細節，在 OIDN 的加持下，僅需約 16 至 32 SPP 即可獲得商業展示級別的平滑輸出。

### 3.3 生態系轉換的權衡與限制

儘管 Apple Metal 架構在硬體效能與降噪品質上提供了極佳的解決方案，但其作為光照設備採購評估工具仍面臨一項嚴峻的挑戰：生態系的封閉性。VIBE CODING 的核心精神在於快速迭代與跨平台的網頁端協作。轉向 Metal 意味著必須拋棄 JavaScript/TypeScript 與 Web 框架的便利性，轉而使用 C++ 與 Metal Shading Language 進行底層開發。這種語言與平台的轉換成本極高，且無法輕易透過網頁連結與燈光設備供應商或聲學顧問進行即時的模型檢視與溝通。

## 第四章：引領網頁圖形革命之 Three.js r184 WebGPU 演進

為了在保持網頁端跨平台便利性的同時，大幅提升光照計算的精確度與效能，Three.js 在近期發佈的 r184 以及逐步演進的 WebGPU 架構中，提供了革命性的基礎設施。這些更新直接針對了大規模幾何渲染、著色器編譯與即時全局光照的痛點，為混音室的燈具採購評估帶來了前所未有的可能性。

### 4.1 Compute Shaders 與記憶體分配的底層重構

WebGPU 最關鍵的技術躍進在於開放了 Compute Shaders 的支援，並賦予開發者更為底層的 GPU 記憶體控制權。Three.js r184 徹底改革了其內部架構，消除了每幀物件的動態分配，這有效避免了傳統 WebGL 中因垃圾回收機制介入而導致的畫面停頓。此一優化的結果極為顯著。以 Segments.ai 等平台的遷移經驗為例，從 WebGL 轉換至 WebGPU 後，在處理包含數百萬個頂點的複雜點雲與幾何數據時，實現了高達 100 倍的效能提升。

此外，Three.js r171 引入的三維著色語言（Three Shader Language, TSL）允許開發者採用「一次編寫，隨處執行（Write once, run everywhere）」的策略，無縫相容 WGSL 與 GLSL 平台。對於混音室模型而言，這意味著系統現在能夠輕鬆負載高達 1,000,000 個粒子單元或超高密度的聲學擴散網格，而不會遭遇 WebGL 時代 50,000 單元的嚴格限制。這為後續的高階光照計算奠定了堅實的幾何基礎。

### 4.2 物理精準照明之鑰：IES 光度學配置檔支援

在探討光照設備之採購評估時，最為核心的技術需求在於「光源的物理真實性」。傳統的點光源（Point Light）或聚光燈（Spot Light）僅能提供均勻分佈或簡單圓錐衰減的理想化光照，這與真實世界中燈具的光學行為相去甚遠。

Three.js r184 針對 WebGPURenderer 原生實作了 IESSpotLight，這是一項具備決定性意義的更新。IES（Illuminating Engineering Society）設定檔是全球照明工業的標準格式，由實體燈具製造商使用測光儀器精確量測後提供。其原始檔案記錄了光源在三維空間中各角度方向的發光強度（以坎德拉 Candela, cd 為單位）。Three.js 的 `IESSpotLight` 在載入 `.ies` 檔案時，會將這些原始光度學數據轉換為正規化的衰減查表紋理（Lookup Table Texture，值介於 0.0 至 1.0 之間），以供 GPU 在著色階段高效取樣。

當 VIBE CODING 整合 IESSpotLight 後，開發者可以直接將供應商提供的 `.ies` 檔案匯入混音室場景中。這使得系統能夠精確模擬無頻閃投射燈在特定距離下的真實衰減（Decay）、最大散射角度（Dispersion Angle），以及因燈具反射罩設計而產生的獨特光暈與非均勻光斑分佈。對於決策者而言，這能準確預測燈具是否會在操作台上產生令人疲勞的眩光，或是洗牆燈打在木製擴散板上的光影層次是否符合設計預期，從而將採購風險降至最低。

### 4.3 SSGI（螢幕空間全局光照）的即時輻照度估計

為了在網頁端即時重現複雜的光線反彈，Three.js r184 引進了 WebGPU SSGI（Screen Space Global Illumination）後處理節點。傳統的螢幕空間環境光遮蔽（SSAO）技術僅能根據幾何深度緩衝區推斷暗角，缺乏對光線輻照度（Irradiance）與色彩溢散（Color Bleeding）的計算能力，這在評估燈光氛圍時會產生極大的視覺落差。

SSGI 的突破在於其演算法機制：它並非單純計算遮蔽，而是在螢幕空間內執行微觀的光線推進（Ray Marching）。透過在地平線搜尋（Horizon Search）過程中精確積分幾何弧度（Integrating Arcs），SSGI 能夠收集視野內各表面的二次光照貢獻，創造出極度逼真的全局光照回饋。其品質與效能取決於切片數量（sliceCount）與步進數量（stepCount）的參數設定，總取樣數為 `sliceCount * stepCount * 2`。

1.  **極致效能與資源節約**：SSGI 的運作完全基於光柵化與 G-buffer，無須構建昂貴的空間加速結構（如 BVH）。相較於傳統依賴光照貼圖烘焙（Lightmap Baking）需要產生高達 40 MB 的龐大紋理資源，採用 SSGI 的場景總資源大小甚至可縮減至低於 9 MB，且燈光能夠維持完全動態，極其適合 VIBE CODING 的快速迭代開發模式。
2.  **物理準確度之侷限**：儘管視覺效果驚人，SSGI 本質上仍是一種受限於畫面視野（Frustum）的近似解。當重要光源或具有高反射率的物體位於螢幕邊界之外（Off-screen）時，其應有的光照貢獻會突然消失，導致場景的亮度分佈不一致。因此，SSGI 可作為極佳的即時預覽與空間佈局工具，但在進行最終的照度量測與嚴謹的設備採購驗證時，仍無法完全取代真正的路徑追蹤物理計算。

### 4.4 光探針網格（LightProbeGrid）的混合式照明策略

為彌補 SSGI 在畫面外遮蔽的缺陷，Three.js r184 同時展示了 LightProbeGrid 技術的進階應用（如 Sponza 與 Cornell Box 範例）。該技術基於球諧函數（Spherical Harmonics, SH），這是一種編碼方向性資料的數學表達式。透過計算空間中某一點從四面八方接收到的光照強度與色彩，並將其壓縮為極少量的浮點數，系統能夠以極低的執行期記憶體成本重現複雜的環境漫反射。

**SH 參數計算過程（Three.js `SphericalHarmonics3` 類別）：**

Three.js 的 `SphericalHarmonics3` 名稱中的「3」代表「涵蓋 3 個 band（band 0、band 1、band 2）」，最高階（ℓ_max）為 2。

1. **基礎係數**：SH 的係數數量由公式 `(ℓ_max + 1)^2` 決定。
   * ℓ_max = 2：`(2 + 1)^2 = 3^2 = 9` 個基礎係數。
2. **顏色通道**：Three.js 以 9 個 `Vector3` 物件儲存係數，每個 `Vector3` 內含 R、G、B 三個分量。
   * RGB 總計：`9 x 3 = 27` 個浮點數。
3. **記憶體佔用**：每個浮點數為 `Float32`（4 Bytes），單一 LightProbe 佔用：
   * `27 x 4 = 108 Bytes`。

此壓縮效率遠高於高解析度環境貼圖（通常需數 MB），適合密集佈放於混音室空間中。

開發者可以利用 Web Workers 在背景非同步地漸進烘焙這些光探針（例如每秒發射數萬至數十萬條路徑），將計算負載從主執行緒分離，徹底解決畫面凍結的問題。這提供了一種混合式的工作流：以 LightProbeGrid 處理大範圍的靜態全局光照，再輔以動態 IES 光源照亮重點區域，為混音室設計提供一個效能與物理準確度兼具的中介解決方案。

## 第五章：網頁原生路徑追蹤與 SVGF 時空降噪引擎

若要在瀏覽器環境中徹底解決屏幕空間技術的物理侷限，同時克服 erichlof 框架收斂緩慢的問題，開發者必須轉向基於 WebGPU Compute Shaders 原生開發的純路徑追蹤架構，並導入時空差異引導濾波（Spatiotemporal Variance-Guided Filtering, SVGF）演算法。

### 5.1 現代網頁端路徑追蹤架構：three-gpu-pathtracer 與 LGL Tracer v3

當前開源社群中，`gkjohnson/three-gpu-pathtracer` 與 `LGL-Tracer-Renderer` (v3) 展現了最前沿的網頁端光追實作能力，但兩者的底層架構有所不同：

1.  **three-gpu-pathtracer（WebGL 2 架構）**：該專案建構於 **WebGL 2** 之上，透過 Fragment Shader 實作路徑追蹤（其 constructor 接受 `WebGLRenderer`）。它將場景的 BVH 與複雜幾何細節高效地打包進紋理記憶體中，並原生支援 GGX 微表面模型、傳輸介質（針對玻璃的精確折射）、金屬粗糙度工作流（Metallic-Roughness Workflow），以及環境貼圖的多重重要性採樣（MIS）。雖然並非使用 Compute Shader，但藉由 Fragment Shader 的巧妙運用，仍能達成高品質的漸進式路徑追蹤。
2.  **LGL Tracer v3（WebGPU 架構）**：LGL Tracer v3 則利用 **WebGPU** 的 Compute Shaders 實現路徑追蹤，並引入了 Disney BSDF 物理材質系統，利用 Web Workers 進行 BVH（基於表面積啟發式，SAH）的多執行緒加速構建。部分實驗性實作甚至支援了 BVH4 加速（4 寬度邊界體積階層）以提升光線遍歷速度，以及注視點收斂渲染（Foveated Convergence Rendering）——即優先收斂螢幕中心區域的雜訊，邊緣區域隨後跟上，大幅提升了互動過程中的視覺流暢度。

### 5.2 SVGF 降噪機制之深入解析

為解決蒙地卡羅積分收斂過慢的問題，這些現代 WebGPU 引擎實作了 SVGF 演算法（或基於 À-trous 小波變換的類似降噪器）。與依賴龐大神經網路權重的 OIDN 或 OptiX 不同，SVGF 是一種專為即時圖形處理器設計、極度依賴數學統計與幾何拓樸特徵的濾波器。

SVGF 的核心運作機制如下：
1.  **時間累積與重投影（Temporal Reprojection）**：系統利用運動向量（Motion Vectors）將前一幀的計算結果重新投影至當前幀的對應像素上。透過時間維度上的資料重複利用，引擎可以在移動相機時保留大部分已經收斂的照明資訊。
2.  **變異數分析與空間過濾**：對於不可避免的雜訊區域，SVGF 會分析相鄰像素的光照變異數（Variance），並在空間維度上進行模糊化處理。
3.  **邊緣停止機制（Edge-Stopping）**：為避免空間模糊導致幾何細節與紋理丟失，SVGF 強度依賴於幾何緩衝區（G-buffer）提供的引導資訊（包含法線 Normal、深度 Depth 與粗糙度 Roughness）。當濾波器偵測到像素之間的法線角度變化過大或深度存在斷層時，會自動停止模糊運算，從而完美保留物體的銳利邊界。

### 5.3 降噪效能對比與實務限制

相較於 erichlof 引擎需要被動等待數百乃至數千 SPP 才能看清混音室暗部細節，搭配 SVGF 的 WebGPU 路徑追蹤可以在極低的預算下（如 1 至 4 SPP 之間）產生視覺上極為平滑、可供即時互動的影像。然而，在嚴格的光照設備採購評估場景中，我們必須正視 SVGF 演算法與業界頂尖技術（如 NVIDIA 的 NRD - Real-Time Denoisers）之間的差距。

NVIDIA 的 NRD 函式庫（包含 RELAX 與 REBLUR 等模組）同樣設計用於處理極低 RPP（Ray Per Pixel）的訊號，但其透過更為先進的球面高斯（Spherical Gaussian）計算與對 RTX 硬件的極致最佳化，在處理 1080p 至 4K 解析度時，提供了比傳統 SVGF 高出約 50% 的執行效能，同時在陰影柔和度與時間穩定性上表現更佳。

受限於 WebGPU 目前缺乏對 NVIDIA NRD 等專有高階 API 的原生支援，Web 端實作的 SVGF 在處理混音室中某些極端光學現象時仍顯吃力。例如，當快速移動強光源，或處理複雜隔音玻璃的多重折射焦散時，SVGF 的時間重投影機制容易產生明顯的殘影（Ghosting）與拖尾效應；在極低光照條件下，偶發的幾何邊界誤判仍會產生無法消除的螢火蟲效應（Fireflies）。這在進行嚴謹的照度與光斑分佈分析時，可能會構成些許的干擾。

## 第六章：工業級驗證標準——基於 MCP 的 Blender 多智慧體自動化管線

針對「評估光照設備之採購」此一終極目標，即便是搭載 SVGF 的 WebGPU 路徑追蹤器，其本質上為兼顧即時互動而採用的數學近似濾波策略，在絕對的物理光線追蹤精準度上，仍與離線渲染的 Ground Truth 存在難以忽視的落差。為徹底解決此一痛點，透過 VIBE CODING 導入模型上下文協定（Model Context Protocol, MCP）並與工業標準軟體 Blender 進行深度整合，是當前最為嚴謹、最具擴展性且能提供決定性物理數據的高階架構方案。

### 6.1 Blender MCP Server 的通訊架構與安全機制

MCP 是一種革命性的標準化協定，它賦予了大型語言模型（LLM，如 Claude、Gemini 或 GPT）直接理解並操作外部複雜工具的能力。透過架設 `blender-mcp-server`，VIBE CODING 的 AI 助手不再受限於網頁端框架，而是能以自然語言指令驅動 Blender 的強大 Python API (bpy)，達成無縫的自動化控制。

1.  **底層通訊邏輯**：當使用者在 AI 客戶端（如 Cursor 或 Windsurf）輸入諸如「載入特定 IES 燈具並聚焦於混音台」的指令時，LLM 會分析可用工具並生成 JSON-RPC 格式的呼叫請求。MCP Server 接收到請求後，透過本地端的 TCP Socket 連線將指令轉發至 Blender 內部運行的 Add-on。為避免多執行緒衝突導致的程式崩潰，該 Add-on 巧妙地利用了 `bpy.app.timers` 持續監聽連接埠，確保所有的 Python 幾何修改、材質賦予與渲染指令，皆在 Blender 的主執行緒（Main Thread）上安全執行。
2.  **動態載入與擴展**：此架構支援超過 100 種核心工具，涵蓋了從點/面/聚光燈的控制、22 種幾何修改器（Modifiers）的疊加、關鍵幀動畫（Keyframes）生成，到極為複雜的 Shader Nodes 與 Geometry Nodes 網路的程式化構建。為了維持系統輕量，系統採用延遲載入（Lazy Loading）機制，AI 可根據任務需求動態發現並啟用額外的工具類別。

### 6.2 3D-Agent：多智慧體（Multi-Agent）系統的視覺回饋控制環

在實務操作中，若單純讓語言模型盲目地呼叫 bpy API 進行連續編輯，極易因為缺乏空間感知而導致模型破面或產生無法預期的「幾何湯（Geometry Soup）」。針對此問題，業界發展出了基於 LangGraph 框架編排的 3D-Agent 多智慧體系統。該系統將任務分拆交由不同專長的神經網路協同處理：

*   **Claude (推理與規劃)**：負責將複雜的燈光佈局任務拆解為依序執行的步驟，決定建造順序。
*   **GPT (程式碼生成)**：利用 RAG（檢索增強生成）技術查詢最新的 Blender Python API 文件，編寫精準的幾何轉換與修改器指令。
*   **Gemini (視覺回饋與驗證)**：這是確保渲染與設計準確性的關鍵。在每一步操作後，系統會控制 Blender 擷取 Viewport 截圖並傳送給 Gemini 進行視覺驗證。若發現 IES 光斑位置偏離或材質法線反轉，系統會觸發「感知 → 推理 → 行動 → 驗證（Perceive → Reason → Act → Verify）」的修正迴圈，確保模型拓樸乾淨且燈光定位準確無誤。這套系統更利用 DSPy 框架對提示詞進行了微調訓練，極大地提升了 LLM 理解 Blender 三維空間座標系的穩定性。

### 6.3 Cycles 渲染與工業級機器學習降噪驗證 (OptiX / OIDN)

當 VIBE CODING 透過 MCP 完成混音室的模型建構與實體 IES `.ies` 檔案的精準擺放後，最後一步便是交由 Blender 內建的 Cycles 渲染引擎進行最終的物理光照驗證。Cycles 採用了嚴謹的單向蒙地卡羅路徑追蹤（Unidirectional Path Tracing）物理模型，能精確計算 IES 光束在聲學擴散木板上的次表面散射（SSS）與粗糙度衰減。

在此階段，我們將徹底擺脫 Web 端降噪器的侷限，直接調用工業最高標準的神經網路降噪器：

*   **NVIDIA OptiX**：由硬體光追巨擘 NVIDIA 開發的 GPU 加速 AI 降噪器，專為電影級工作流與高效能互動預覽設計。與傳統的 NLM（Non-Local Means）濾波器相比（NLM 雖能保持邊緣銳利，但在低光源處會產生大量偽影 Artifacts 與黑色邊緣），OptiX 利用 Albedo 與 Normal 通道，能在例如僅有 16 SPP 的極低樣本率下，智慧預測並重建出銳利的畫面。其 7.3 版本後支援的時間降噪（Temporal Denoising）功能，進一步整合了向量（Vector）渲染通道，有效消除了攝影機巡視混音室時的動態閃爍（Flickering）。
*   **Intel OIDN**：若硬體配置為 CPU 或非 NVIDIA GPU，則可透過 Compositor 節點完整啟用 OIDN。儘管在早期版本中 OIDN 被認為在處理極高頻率細節時會產生輕微的過度模糊（Over-blur），但其在處理粗糙金屬表面與漫反射材質上的粗糙雜訊時表現卓越。透過設定預先濾波（Prefiltering）至準確模式（Accurate），並結合多 AOV 通道輔助，OIDN 能產出無比純淨、極具照片寫實感的最終渲染結果。

這是目前最能確保「採購清單上的燈具在實際安裝後，與 3D 數位孿生模型的照度預測結果高度吻合」的終極驗證途徑。（注意：由於建模簡化、材質參數精度與 IES 量測誤差等因素，實務上無法達到絕對的 100% 物理對齊，但 Cycles 所提供的精度已足以作為可靠的商業採購決策依據。）

## 第七章：降噪技術與架構之深度量化與質化對比

為使設計團隊與採購決策者能精確選擇適配的技術工具，本章將上述涵蓋的五種核心渲染與降噪架構，依據其運作機制、收斂效能與光學物理精確度進行系統性的比較分析：

**表 7-1：混音室光照模擬之核心渲染技術與降噪架構綜合比較**

| 技術架構 / 引擎 | 降噪核心演算法 | 硬體與平台依賴性 | 雜訊收斂速度 | 光學物理準確度 | 複雜光照處理能力 (IES 支援、次表面散射、多重反彈) | 最佳應用場景定位 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Erichlof (WebGL)** | 單純時間累積<br>(Temporal Accumulation) | 跨平台瀏覽器<br>(單執行緒限制) | 極慢<br>(需被動等待數百至上千 SPP) | 高<br>(於無限累積狀態下) | 極差<br>(缺乏神經網路重建，易崩潰，不支援高精度 IES) | 早期技術驗證與基礎形體展示，不適合作為採購評估依據 |
| **Three.js WebGPU (SSGI)** | 螢幕空間光線推進與積分<br>(Horizon Search & Arcs) | 現代瀏覽器<br>(支援 WebGPU 計算著色器) | 極快<br>(可維持穩定即時 60FPS) | 中 | 中等<br>(原生支援 IESSpotLight，具備初步色溫衰減，但缺乏畫面外全域遮蔽計算) | 空間佈局之快速迭代、燈光擺位與即時互動初判 |
| **WebGPU Path Tracer** | SVGF<br>(時空變異數導向濾波與 G-buffer 邊緣停止) | 現代瀏覽器<br>(高效能 GPU 尤佳) | 快<br>(數個 SPP 即可達視覺平滑) | 高 | 良好<br>(受限於時間重投影，快速移動強光源時易產生局部殘影 Ghosting) | 高品質之網頁端客戶展示、無須安裝軟體的雲端互動預覽 |
| **Apple Metal Path Tracer** | OIDN 2.3.3<br>(依賴 AOV 與樣本計數通道的神經網路) | 高度綁定 macOS 系統與 Apple Silicon (硬體光追單元) | 中快<br>(受惠於 MPSRayIntersector 與 TLAS/BLAS 硬體加速) | 極高 | 優異<br>(支援 MNEE 處理玻璃焦散與精確光線反彈) | 蘋果生態系內部的專業室內設計與高效能離線渲染 |
| **Blender MCP (Cycles)** | OptiX / OIDN<br>(基於百萬圖像訓練的工業級神經網路) | 本地端工作站或雲端渲染伺服器<br>(整合 TCP 通訊) | 中<br>(依賴 LLM 推理與跨行程通訊，屬非即時/離線範疇) | 絕對基準<br>(Ground Truth) | 完美<br>(原生精確解析 IES 光度學資料，計算無損之多次反彈與材質透射) | 終極光照設備採購決策、工業標準輸出與無誤差驗證 |

### 7.1 收斂速度與物理失真間的取捨哲學

在審視表 7-1 的數據時，核心的技術權衡在於「消滅雜訊的手法是否會破壞物理特徵」。SVGF 雖然能在 WebGPU 環境中達到驚人的即時降噪速度，但其本質是一種高度優化的「模糊（Blurring）」工具。當它試圖抹平混音室中因低反照率材質造成的劇烈光照變異數時，極易將黑色吸音棉的微小孔洞紋理，或是胡桃木聲學擴散板邊緣的銳利陰影一併模糊掉。

相反地，OptiX 與 OIDN 這些神經網路模型並不僅僅是在進行模糊運算，它們是在「預測（Predicting）」與「重建（Reconstructing）」高頻細節。這種重建能力對於評估特定燈具（如狹角聚光燈）照射在特定材質（如具備清晰拉絲紋理的鋁合金混音台控制面板）上所產生的質感反射，具有無可取代的決策價值。

## 第八章：結論與光照設備採購評估之整合實踐藍圖

在基於大型語言模型輔助的 VIBE CODING 流程中，企圖透過傳統的 erichlof WebGL 框架來構建混音室並進行專業的光照設備採購評估，已被證實存在無法克服的物理與效能屏障。其缺乏現代化機器學習降噪器、記憶體管理缺陷以及單純依賴時間累積的蒙地卡羅機制，無法提供決策所需的精確輻照度數據與流暢的視覺體驗。

為達成更加真實、降噪收斂更快，且能切實指導光照設備採購的光線追蹤目標，本報告基於嚴謹的技術驗證，強烈建議設計團隊採用多層次、跨架構的混合實踐藍圖：

### 第一階段：空間佈局與即時燈光迭代（Three.js WebGPU 升級）

在 VIBE CODING 的開發初期，應果斷將渲染底層全面遷移至 Three.js r184 的 `WebGPURenderer`。透過導入 `IESSpotLight` 結合實體燈具的光度學檔案，並開啟基於 Compute Shader 的 SSGI（螢幕空間全局光照）節點，AI 助手能夠以毫秒級的回饋速度，極高效率地完成混音室的燈位配置、色溫設定與基礎照度分佈預估。對於需要展示給非技術端客戶的雲端連結，則可無縫切換至整合了 SVGF 時空降噪機制的 WebGPU 路徑追蹤器，以數個 SPP 的極低成本，提供無畫面外遮蔽限制、且具備流暢互動品質的全域光照預覽。

### 第二階段：採購決策之絕對物理驗證（Blender MCP 多智慧體管線）

然而，面對動輒數十萬元的專業燈光設備採購決策，任何基於屏幕空間的近似演算法或即時降噪機制（如 SSGI 或 SVGF），都不可避免地存在導致誤判的光學微小誤差。因此，建立一套基於 MCP（模型上下文協定）的自動化管線，將 VIBE CODING 的指令直接轉譯為 Blender Python API，是不可妥協的工業界標準。

透過 LangGraph 驅動的多智慧體系統（以 Gemini 提供視覺驗證，Claude 進行邏輯推理），開發團隊可以自動化地在 Blender 中完美重現網頁端的 IES 配置與材質屬性。最終交由 Cycles 渲染引擎，並強制掛載 OptiX 或 OIDN 工業級神經網路降噪器進行計算。此一階段所輸出的影像數據，無論是在低樣本率下的銳利細節重建，或是精準模擬光束在聲學擴散板間的多次反彈與能量衰減，皆能達到高度逼近真實世界物理特性的 Ground Truth 標準，足以作為商業採購決策的可靠依據。

唯有透過這套從前端 WebGPU 高速迭代，無縫銜接至後端 Blender MCP 物理驗證的嚴謹工作流，方能為專業混音室的光照設備採購，提供零誤差的技術保障與決策依據。

## 第九章：實務問答與後續升級指南

基於前述報告之結論，若將目標聚焦於「達成 90% 真實度即足以作為採購評估」的務實前提，推動「第一階段：Three.js WebGPU 升級」為最具成本效益且可行的方案。針對實務執行面上可能遭遇的挑戰，彙整以下問答與升級前置準備指南：

### 9.1 實務討論與問答 (Q&A)

**Q1：若物色的燈具沒有提供 IES 光度學檔案怎麼辦？**
針對小眾或未提供 IES 檔案的燈具，可採用以下兩種替代方案：
1. **物理測量與手動校準**：取得實體燈具後，使用具備專業測量精度之照度計 App（如 LM-3000），量測其在特定距離（如 1m、2m）下的實際照度（Lux）。隨後在 Three.js 中手動調整光源強度與衰減（Decay）參數，使 3D 空間內的數值與實測數據對齊。
2. **光斑形狀的程序化拆解（Procedural Shaping）**：透過節點（Nodes）將光束拆解為光杯（Cup）、中心熱點（Hotspot）、光刺（Spike）與環境漫射（Ambient）四個核心視覺元素。藉由手動疊加這些參數，即可逼真重現燈具打在牆面上的視覺層次與擴散衰減，無須絕對依賴原廠 IES 檔案。

**Q2：若 Blender MCP 無法精準還原 1:1 數位孿生錄音室怎麼辦？**
在光照模擬實務中，「極度複雜的 1:1 幾何模型」未必能帶來更精準的光照評估。
* 較粗略或中等複雜度的幾何模型，往往能提供更準確的光照呈現與更快的計算速度。
* 無須執著於 1:1 建立每塊擴散板的微小溝槽，只需確保混音室的「主要幾何空間長寬高」正確，並賦予牆面與吸音材質準確的反射率（Albedo）與粗糙度（Roughness），使用簡化代理模型（Proxy Meshes）來評估平均照度與眩光即已足夠科學且有效。

**Q3：將架構改寫為 Apple Metal 交由 AI (Claude Code / GPT Codex) 執行的可行性？**
* **AI 生成底層圖形 API 的極限**：若要求 AI 將龐大的 WebGL 專案完整翻譯為 Apple Metal（涉及 C++/Swift、MSL 著色語言及複雜記憶體管理），極易因超出 AI 脈絡理解且缺乏自動化視覺測試驗證而導致失敗。
* **務實的 AI 輔助開發策略**：AI 確實具備 Metal GPU 相關知識，但工程師必須將任務極度細化，或搭配如 `Naga` 等編譯工具自動轉換 GLSL/WGSL 至 MSL，再由 AI 處理外圍除錯。這並非「一鍵轉換」的輕鬆工作。因此，若 WebGPU 方案已可達 90% 需求，建議暫緩轉換至 Apple Metal 的龐大工程。

### 9.2 Three.js WebGPU 架構升級前置準備指南

決定朝 Three.js r184 WebGPU 升級後，需先進行專案現況盤點與開發環境確認，以規劃最保險的升級路徑。

**一、 專案程式碼盤點（尋找需重構之技術債）：**
1. **自訂著色器 (Custom Shaders)**：檢查是否使用舊版 GLSL 著色器（如 `ShaderMaterial`、`RawShaderMaterial` 或透過 `onBeforeCompile` 覆寫）。WebGPU 底層已改用全新的 TSL (Three Shader Language) 節點系統，舊有 GLSL 字串需轉換為 TSL 才能發揮效能並支援跨平台。
2. **後期處理特效 (Post-processing)**：檢查是否有使用舊版 `EffectComposer` 或自訂通道（Pass），這些亦需遷移至 WebGPU 對應的 TSL 節點架構。
3. **第三方依賴套件**：列出目前搭配的 3D 第三方函式庫，並確認其是否已相容於 Three.js r184 版本。

**二、 系統與硬體相容性檢查：**
WebGPU 依賴現代作業系統的底層圖形 API（DirectX 12 / Metal / Vulkan）及瀏覽器支援：
1. **瀏覽器支援度**：Chrome 113+、Edge、Safari 26+ 皆已預設支援。Firefox 需在 Nightly 版本手動開啟。最快的測試方式為在瀏覽器網址列輸入 `chrome://gpu`，檢視 **WebGPU** 項目是否顯示為 `Hardware accelerated`。
2. **硬體 GPU 檢測**：若需評估顯卡資源是否足以負載 SSGI 等高階光照計算，可透過 CLI 指令查詢顯示卡型號：
   * **macOS**: 於終端機執行 `system_profiler SPDisplaysDataType`
   * **Windows**: 於 CMD / PowerShell 執行 `wmic path win32_VideoController get name`
   * **Linux**: 於終端機執行 `lspci | grep -iE 'VGA|3D|video'`

## 第十章：專案現況評估與 WebGPU 升級 SOP 大綱

為確保升級計畫順利推進，本章針對本專案（`/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D`）進行了實際的環境盤點與硬體檢測，並據此制定初步的升級標準作業程序（SOP）。

### 10.1 系統與硬體環境評估：完美支援 WebGPU
* **硬體規格**：Apple M4 Pro (20-Core GPU)，支援 Metal 3。M4 Pro 繼承了自 M3 系列起引入的硬體加速光線追蹤單元（Hardware-Accelerated Ray Tracing），可在 Metal API 層級直接受惠於 MPSRayIntersector 的硬體加速。
* **評估結論**：此硬體配置優異，在現代瀏覽器（Chrome / Safari / Edge）端執行 WebGPU 沒有效能瓶頸。其 20 核心 GPU 足以應付 Three.js 的 SSGI（螢幕空間全局光照）與高複雜度的渲染運算，為升級計畫提供了穩固的底層硬體保障。

### 10.2 專案架構現況與技術債盤點
經實際檢視專案目錄與 `Home_Studio.html` 原始碼，專案呈現以下特徵與挑戰：

* **輕量化前端架構**：專案為純粹的 Vanilla JS 搭配 Import Maps 載入 `./js/three.module.min.js`，未採用 npm、Webpack 或 Vite。這大幅降低了建置環境的轉換成本，升級 Three.js 核心版本只需替換模組檔案或修改 CDN 連結即可。
* **目前 Three.js 版本**：經由 `require()` 讀取 `REVISION` 確認為 **r183**，距離目標版本 r184 僅差一個版本，升級跨度較小。
* **核心技術債（erichlof GLSL）**：專案最大的升級挑戰在於徹底捨棄 `erichlof` 框架。`shaders/` 目錄中包含 7 個 `.glsl` 檔案，其中主要的 `Home_Studio_Fragment.glsl` 約 79 KB。`InitCommon.js` 中以 `THREE.ShaderMaterial` 建立了 6 個材質實例（`pathTracingMaterial`、`screenCopyMaterial`、`screenOutputMaterial`、以及 3 個 Bloom 相關材質），這些都需要在升級時遷移至 TSL 節點架構。
* **Bloom 後處理管線**：目前的 Bloom 效果（Brightpass → Downsample → Upsample）以 3 個獨立的 `.glsl` 檔案 + 3 個 `ShaderMaterial` 實現。WebGPU 升級時需一併遷移至 Three.js r184 原生的後處理節點系統。
* **erichlof 殘留檔案**：`js/` 目錄下共 64 個檔案，其中約 40+ 個為 erichlof 框架的範例場景檔（如 `Cornell_Box.js`、`Bi-Directional_PathTracing.js`、`BVH_Visualizer.js` 等），並非 Home Studio 直接使用。升級時可考慮清理以降低專案體積與維護負擔。
* **冗餘模組檔案**：`js/` 目錄中同時存在 `three.module.min.js`（359 KB）與 `three.core.min.js`（382 KB），後者用途不明，可能為舊版備份，建議升級時一併清理。

### 10.3 WebGPU 升級標準作業程序 (SOP) 大綱

#### 開發策略：從官方範例重建

經評估，現有專案的核心渲染管線（erichlof 自訂 GLSL path tracer）與目標架構（WebGPU 光柵化 + 後處理）完全不同，不存在漸進遷移的中間態。因此建議採用「從範例重建」策略：以 Three.js r184 官方 WebGPU 範例為骨架，僅將場景定義（房間幾何、材質參數、燈光配置、UI 控制面板）從舊專案移植過來。

**參考範例來源：**
* `webgpu_postprocessing_ao.html` — GTAO 後處理 + RoomEnvironment + GLB 模型載入
* `webgpu_lights_ies_spotlight.html` — IESSpotLight + 物理光照單位
* `webgpu_postprocessing_ssgi.html` — SSGI 後處理節點
* `webgpu_lights_physical.html` — 物理光照單位 + Reinhard 色調映射

#### 四層光照架構

升級後的渲染管線採用四層疊加架構，每層各司其職：

| 層級 | 技術 | 職責 | 特性 |
| :--- | :--- | :--- | :--- |
| **L1 基礎環境光** | `RoomEnvironment` + `PMREMGenerator` | 為 PBR 材質提供反射與環境光採樣，避免金屬/光滑表面死黑 | 靜態、與場景物件顏色無關、零運算成本 |
| **L2 直接光照** | `IESSpotLight` + 物理光照單位（Lumens） | 精確模擬採購候選燈具的衰減模式、光型與色溫 | 動態可調、`decay = 2`（平方反比）、載入實體 `.ies` 檔案 |
| **L3 間接光反彈** | `SSGI`（SSGINode） | 即時計算色溢（Color Bleeding）與間接光反彈，紅色吸音板會讓周圍偏紅、木頭家具讓空間偏暖 | 動態回應材質顏色變化、畫面外光源貢獻會消失 |
| **L4 接觸陰影** | `GTAO`（AONode） | 牆角、設備底部、物體交界處的自然暗邊 | 純螢幕空間、效能成本低、大幅提升空間立體感 |

#### 與現有 Path Tracing 的取捨

此四層光照架構與現有的 erichlof path tracing 方案是**不同的技術取捨**，並非全面升級：

| 面向 | Path Tracing（現有） | 四層光柵化（WebGPU 升級） |
| :--- | :--- | :--- |
| **速度** | 慢（需等待數百 SPP 收斂） | 快（穩定 60FPS） |
| **畫面乾淨度** | 有底噪，暗面收斂困難 | 乾淨無噪點 |
| **物理精確度** | 高（光線真實反彈） | 近似（SSGI 為螢幕空間估算，RoomEnvironment 為靜態假環境，GTAO 非真實陰影投射） |
| **色溢精確度** | 精確（光線攜帶表面顏色反彈） | 近似（SSGI 僅計算畫面內可見表面的色溢，畫面外貢獻消失） |
| **適用定位** | 最終精確驗證、截圖輸出 | 快速互動探索、即時佈局比較 |

兩者可採「雙模式切換」並存：互動階段使用四層光柵化獲得即時回饋，定案後切換至 path tracing 模式進行最終物理驗證。

#### 第一階段：環境建置與基礎渲染

1. **建立新檔案** `Home_Studio_WebGPU.html`，不修改現有專案。
2. **Import Map 設定**：
   ```html
   <script type="importmap">
   {
       "imports": {
           "three": "https://unpkg.com/three@0.184.0/build/three.webgpu.js",
           "three/tsl": "https://unpkg.com/three@0.184.0/build/three.tsl.js",
           "three/addons/": "https://unpkg.com/three@0.184.0/examples/jsm/"
       }
   }
   </script>
   ```
3. **初始化 WebGPU 渲染器**：
   ```javascript
   import * as THREE from 'three';
   import { pass, ao } from 'three/tsl';
   import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

   const renderer = new THREE.WebGPURenderer({ antialias: true });
   renderer.toneMapping = THREE.ReinhardToneMapping;
   renderer.toneMappingExposure = 3.0;
   await renderer.init();

   // L1: 基礎環境光
   const environment = new RoomEnvironment( renderer );
   const pmremGenerator = new THREE.PMREMGenerator( renderer );
   scene.environment = pmremGenerator.fromScene( environment ).texture;
   ```

#### 第二階段：場景建構與材質配置

1. **房間幾何**：將 `Home_Studio.js` 中的房間尺寸、吸音板位置、家具佈局以 `THREE.BoxGeometry` / `THREE.PlaneGeometry` 重建，或匯入預製的 GLB 模型。
2. **材質替換**：全面使用 `MeshStandardMaterial` 或 `MeshPhysicalMaterial`，配置正確的 `color`、`roughness`、`metalness`。吸音板的顏色切換邏輯直接修改 `material.color`，SSGI 會即時反映色溢變化。
3. **UI 面板**：從現有專案直接複製 HTML + CSS（配置選擇、燈光控制、相機預設），僅需修改 JS 綁定邏輯。

#### 第三階段：光照配置與後處理管線

1. **L2 — IESSpotLight**：載入實體燈具的 `.ies` 檔案，以物理光照單位（Lumens）配置燈位、色溫與強度。
2. **L3 — SSGI**：加入 SSGINode 後處理節點，調整 `sliceCount` 與 `stepCount` 達到效能與色溢品質的平衡。
3. **L4 — GTAO**：加入 AONode 後處理節點，設定適當的半徑與強度。
4. **色調映射校準**：調整 `toneMappingExposure` 使整體亮度與真實室內照度感受一致。

#### 從舊專案帶走的資產清單

| 資產 | 來源檔案 | 說明 |
| :--- | :--- | :--- |
| 房間幾何尺寸 | `Home_Studio.js` | 牆壁、天花板、地板的座標與厚度 |
| 吸音板佈局 | `Home_Studio.js` | 9 塊板的位置與色彩切換邏輯 |
| 燈光配置 | `Home_Studio.js` | Cloud 漫射燈、軌道燈、廣角燈的位置與參數 |
| 4 組 Config 狀態機 | `Home_Studio.js` | 配置 1/2/3/4 的切換邏輯 |
| UI 面板 | `Home_Studio.html` + `css/default.css` | 完整的 HTML 結構與 CSS 樣式 |
| 相機預設位置 | `Home_Studio.js` | 3 個視角的座標與朝向 |

#### 可丟棄的技術債

| 資產 | 說明 |
| :--- | :--- |
| `shaders/` 目錄全部 7 個 `.glsl` | erichlof path tracing 專用，新架構不使用 |
| `InitCommon.js` | 舊渲染管線（ShaderMaterial × 6、累積緩衝區） |
| `PathTracingCommon.js` | 路徑追蹤共用函式 |
| `BVH_*.js`（4 個） | BVH 加速結構建構器，新架構不使用 |
| `js/` 目錄下約 40+ 個 erichlof 範例場景 | 非 Home Studio 使用 |
| `three.core.min.js` | 用途不明的冗餘模組 |

此 SOP 大綱可作為後續 AI 助理（如 Claude Code 或 GPT Codex）接手開發時的最高指導原則，確保架構升級方向精準無誤。

