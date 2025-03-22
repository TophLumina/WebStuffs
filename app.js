// 全局变量定义
const digits = 4; // 小数点保留位数
let apikey = ""; // 动态加载的 API 密钥
let source = ""; // 动态加载的基准货币
let target_buffer_rate = {}; // 动态加载的缓冲汇率
let rate_sheet = null; // 当前汇率表数据

// 创建并添加显示下一次查询时间的容器
const nextQueryElement = document.createElement("div");
nextQueryElement.id = "nextQueryContainer";
document.body.appendChild(nextQueryElement);

// 创建并添加显示汇率表的容器
const outputElement = document.createElement("div");
outputElement.id = "rateSheetContainer";
document.body.appendChild(outputElement);

// 用于存储下一次查询时间
let nextQueryTime = null;

/**
 * 更新下一次查询时间并启动倒计时
 * @param {number} intervalMs - 距离下一次查询的时间间隔（毫秒）
 */
function updateNextQuery(intervalMs = 10 * 60 * 1000) {
    const now = new Date();
    nextQueryTime = new Date(now.getTime() + intervalMs); // 设置下一次查询时间

    // 确保容器清空
    nextQueryElement.textContent = "";

    // 创建并添加 "Next query at" 元素
    const nextQueryAtElement = document.createElement("span");
    nextQueryAtElement.className = "next-query-at";
    nextQueryAtElement.textContent = `Next query at: ${nextQueryTime.toLocaleString()}`;
    nextQueryElement.appendChild(nextQueryAtElement);

    // 添加换行符
    nextQueryElement.appendChild(document.createElement("br"));

    // 创建并添加 "Next query in" 元素
    const nextQueryInElement = document.createElement("span");
    nextQueryInElement.className = "next-query-in";
    nextQueryElement.appendChild(nextQueryInElement);

    // 启动倒计时
    function updateCountdown() {
        const now = new Date();
        const timeDiff = Math.max(0, nextQueryTime - now); // 计算剩余时间（毫秒）
        const minutes = Math.floor(timeDiff / (1000 * 60));
        const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

        // 更新倒计时内容
        nextQueryInElement.textContent = `Next query in: ${minutes}m ${seconds}s`;

        // 如果倒计时未结束，继续更新
        if (timeDiff > 0) {
            setTimeout(updateCountdown, 1000); // 每秒更新一次
        }
    }

    updateCountdown(); // 启动倒计时更新
}

/**
 * 从本地 JSON 文件加载配置，包括 API 密钥、基准货币和缓冲汇率
 * @returns {Promise<void>}
 */
function loadConfig() {
    return fetch(`config.json?timestamp=${new Date().getTime()}`)
        .then((response) => {
            if (!response.ok) {
                throw new Error("Failed to load config.json");
            }
            return response.json();
        })
        .then((data) => {
            apikey = data.apikey; // 动态加载 API 密钥
            source = data.source; // 动态加载基准货币
            target_buffer_rate = data.buffer_rates; // 动态加载缓冲汇率

            console.log("Loaded target_buffer_rate:", target_buffer_rate);
            console.log("Loaded apikey:", apikey);
            console.log("Loaded source:", source);
        })
        .catch((error) => {
            console.error("Error loading config:", error);
        });
}

/**
 * 检查并更新汇率表数据
 * 优先使用 localStorage 中的汇率数据（如果未过期），否则从 API 获取最新数据
 */
function checkAndUpdateRateSheet() {
    const lastUpdatedTimestamp = localStorage.getItem("rate_sheet_last_updated"); // 获取上次更新的时间戳
    const now = Date.now(); // 当前时间的时间戳（毫秒）

    // 检查 localStorage 中是否有未过期的数据（10 分钟内有效）
    if (lastUpdatedTimestamp && now - parseInt(lastUpdatedTimestamp, 10) < 10 * 60 * 1000) {
        const storedRateSheet = localStorage.getItem("rate_sheet");
        if (storedRateSheet) {
            rate_sheet = JSON.parse(storedRateSheet); // 从 localStorage 加载数据
            console.log("Loaded rate_sheet from localStorage:", rate_sheet);
            display(rate_sheet); // 更新页面显示
            return; // 直接返回，不再调用 API
        }
    }

    // 如果 localStorage 中没有有效数据，则从 API 获取最新数据
    fetch(`https://v6.exchangerate-api.com/v6/${encodeURIComponent(apikey)}/latest/${encodeURIComponent(source)}`)
        .then((response) => {
            if (!response.ok) {
                throw new Error("Failed to fetch exchange rates.");
            }
            return response.json();
        })
        .then((data) => {
            rate_sheet = data.conversion_rates; // 更新汇率表数据

            // 保存到 localStorage
            localStorage.setItem("rate_sheet", JSON.stringify(rate_sheet));
            localStorage.setItem("rate_sheet_last_updated", Date.now().toString()); // 保存当前时间戳
            console.log("Updated and saved to localStorage:", rate_sheet);

            display(rate_sheet); // 更新页面显示

            // 在成功获取数据后更新下一次查询时间
            updateNextQuery(10 * 60 * 1000); // 设置下一次查询时间为 10 分钟后
        })
        .catch((error) => {
            console.error("Error fetching data:", error);

            // 显示错误提示框
            const errorElement = document.createElement("div");
            errorElement.className = "error-popup";
            errorElement.textContent = "CRITICAL: Failed to fetch exchange rates. Please try again later.";
            document.body.appendChild(errorElement);

            // 10 分钟后移除提示框
            setTimeout(() => {
                errorElement.remove();
            }, 600000);
        });

    // 在成功获取数据后更新下一次查询时间
    updateNextQuery(10 * 60 * 1000); // 设置下一次查询时间为 10 分钟后
}

/**
 * 显示汇率表数据
 * @param {Object} rateSheet - 汇率表数据
 */
function display(rateSheet) {
    // 清空当前的内容
    outputElement.innerHTML = "<h2>Exchange Rates</h2>";

    // 创建表格元素
    const table = document.createElement("table");
    table.className = "rate-table";

    // 创建表头
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    const currencyHeader = document.createElement("th");
    currencyHeader.textContent = "Currency";
    const lowerRateHeader = document.createElement("th");
    lowerRateHeader.textContent = "Buying";
    const upperRateHeader = document.createElement("th");
    upperRateHeader.textContent = "Selling";

    headerRow.appendChild(currencyHeader);
    headerRow.appendChild(lowerRateHeader);
    headerRow.appendChild(upperRateHeader);
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // 创建表格主体
    const tbody = document.createElement("tbody");

    // 遍历汇率表数据并生成表格行
    for (const [cur, rate] of Object.entries(rateSheet)) {
        if (target_buffer_rate[cur] !== undefined) {
            const row = document.createElement("tr");

            const currencyCell = document.createElement("td");
            currencyCell.textContent = cur;

            const lowerRateCell = document.createElement("td");
            lowerRateCell.textContent = (rate - target_buffer_rate[cur]).toFixed(digits);

            const upperRateCell = document.createElement("td");
            upperRateCell.textContent = (rate + target_buffer_rate[cur]).toFixed(digits);

            row.appendChild(currencyCell);
            row.appendChild(lowerRateCell);
            row.appendChild(upperRateCell);

            tbody.appendChild(row);
        }
    }

    table.appendChild(tbody);
    outputElement.appendChild(table);
}

// 确保配置加载完成后再执行查询
loadConfig().then(() => {
    checkAndUpdateRateSheet();
    setInterval(checkAndUpdateRateSheet, 10 * 60 * 1000); // 每 10 分钟更新一次
});

