const apikey = "88ca2fb954408f0240a369ad";
const source = "AUD";
const digits = 4;
let target_buffer_rate = {};
let rate_sheet = null;

// 创建一个显示下一次查询时间的容器
const nextQueryElement = document.createElement("div");
nextQueryElement.id = "nextQueryContainer";
document.body.appendChild(nextQueryElement);

// 获取 HTML 中的目标容器
const outputElement = document.createElement("div");
outputElement.id = "rateSheetContainer";
document.body.appendChild(outputElement);

// 更新下一次查询时间的显示
let nextQueryTime = null; // 用于存储下一次查询的时间

function updateNextQueryTime() {
    const now = new Date();
    nextQueryTime = new Date(now.getTime() + 10 * 60 * 1000); // 当前时间加 10 分钟
    nextQueryElement.textContent = `Next query at: ${nextQueryTime.toLocaleString()}`;
}

// 每秒更新倒计时
function updateNextQueryCountdown() {
    if (nextQueryTime) {
        const now = new Date();
        const timeDiff = Math.max(0, nextQueryTime - now); // 计算剩余时间（毫秒）
        const minutes = Math.floor(timeDiff / (1000 * 60));
        const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
        nextQueryElement.textContent = `Next query in: ${minutes}m ${seconds}s`;
    }
}

// 从本地 JSON 文件加载 target_buffer_rate
function loadTargetBufferRate() {
    fetch("target_buffer_rate.json")
        .then((response) => {
            if (!response.ok) {
                throw new Error("Failed to load target_buffer_rate.json");
            }
            return response.json();
        })
        .then((data) => {
            target_buffer_rate = data;
            console.log("Loaded target_buffer_rate:", target_buffer_rate);
        })
        .catch((error) => {
            console.error("Error loading target_buffer_rate:", error);
        });
}

// 检查并更新数据的函数
function checkAndUpdateRateSheet() {
    // 发起 fetch 请求更新数据
    fetch(`https://v6.exchangerate-api.com/v6/${encodeURIComponent(apikey)}/latest/${encodeURIComponent(source)}`)
        .then((response) => {
            if (!response.ok) {
                throw new Error("Failed to fetch exchange rates.");
            }
            return response.json();
        })
        .then((data) => {
            rate_sheet = data.conversion_rates;

            // 保存到 localStorage
            localStorage.setItem("rate_sheet", JSON.stringify(rate_sheet));
            console.log("Updated and saved to localStorage:", rate_sheet);

            display(rate_sheet); // 更新 HTML
        })
        .catch((error) => {
            console.error("Error fetching data:", error);

            // 创建一个提示框元素
            const errorElement = document.createElement("div");
            errorElement.className = "error-popup"; // 添加类名
            errorElement.textContent = "CRITICAL: Failed to fetch exchange rates. Please try again later.";

            // 将提示框添加到页面
            document.body.appendChild(errorElement);

            // 10 分钟后移除提示框
            setTimeout(() => {
                errorElement.remove();
            }, 600000);
        });

    // 更新下一次查询时间
    updateNextQueryTime();
}

// 定义一个函数来将 rate_sheet 显示在 HTML 页面上
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

    // 遍历 rateSheet 并仅显示 target 中的货币
    for (const [cur, rate] of Object.entries(rateSheet)) {
        if (target_buffer_rate[cur] !== undefined) {
            const row = document.createElement("tr");

            // 创建货币代码单元格
            const currencyCell = document.createElement("td");
            currencyCell.textContent = cur;

            // 创建减去 buffer 的值单元格
            const lowerRateCell = document.createElement("td");
            lowerRateCell.textContent = (rate - target_buffer_rate[cur]).toFixed(digits);

            // 创建加上 buffer 的值单元格
            const upperRateCell = document.createElement("td");
            upperRateCell.textContent = (rate + target_buffer_rate[cur]).toFixed(digits);

            // 将单元格添加到行
            row.appendChild(currencyCell);
            row.appendChild(lowerRateCell);
            row.appendChild(upperRateCell);

            // 将行添加到表格主体
            tbody.appendChild(row);
        }
    }

    // 将表格主体添加到表格
    table.appendChild(tbody);

    // 将表格添加到输出容器
    outputElement.appendChild(table);
}

// 初始加载 target_buffer_rate
loadTargetBufferRate();

// 初始检查并更新
checkAndUpdateRateSheet();

// 每 10 分钟更新一次（10 分钟 = 600,000 毫秒）
setInterval(checkAndUpdateRateSheet, 10 * 60 * 1000);

// 每秒更新倒计时
setInterval(updateNextQueryCountdown, 1000);

