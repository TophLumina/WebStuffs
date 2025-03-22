const apikey = "88ca2fb954408f0240a369ad";
const source = "AUD";
const target_buffer_rate = {
    "CNY": 3,
    "USD": 3,
    "HKD": 1,
    "NZD": 1,
    "JPY": 1,
    "EUR": 1,
    "CAD": 1,
    "GBP": 1,
    "SGD": 1,
    "MYR": 1,
    "TWD": 1,
    "INR": 1
};
const digits = 4;
let rate_sheet = null;

// 创建一个显示下一次查询时间的容器
const nextQueryElement = document.createElement("div");
nextQueryElement.id = "nextQueryContainer";
document.body.appendChild(nextQueryElement);

// 获取 HTML 中的目标容器
const outputElement = document.createElement("div");
outputElement.id = "rateSheetContainer";
document.body.appendChild(outputElement);

// 获取当前日期（以 GMT+2 为基准）
function getCurrentDateInGMT2() {
    const now = new Date();
    const gmt2Offset = 2 * 60; // GMT+2 的分钟偏移
    const localOffset = now.getTimezoneOffset(); // 本地时区的分钟偏移
    const gmt2Time = new Date(now.getTime() + (gmt2Offset + localOffset) * 60 * 1000);
    return gmt2Time.toISOString().split("T")[0]; // 返回日期部分（YYYY-MM-DD）
}

// 计算距离 GMT+2 凌晨 0 点的时间（毫秒）
function getTimeUntilNextGMT2Midnight() {
    const now = new Date();
    const gmt2Offset = 2 * 60; // GMT+2 的分钟偏移
    const localOffset = now.getTimezoneOffset(); // 本地时区的分钟偏移

    // 当前时间的 GMT+2 时间
    const gmt2Now = new Date(now.getTime() + (gmt2Offset + localOffset) * 60 * 1000);

    // 当天 GMT+2 凌晨 0 点
    const gmt2Midnight = new Date(gmt2Now);
    gmt2Midnight.setUTCHours(22, 0, 0, 0); // GMT+2 凌晨 0 点等于 UTC 时间 22:00:00

    // 如果当前时间已经过了 GMT+2 凌晨 0 点，则计算第二天的 GMT+2 凌晨 0 点
    if (gmt2Now >= gmt2Midnight) {
        gmt2Midnight.setUTCDate(gmt2Midnight.getUTCDate() + 1);
    }

    return gmt2Midnight - gmt2Now; // 返回距离 GMT+2 凌晨 0 点的毫秒数
}

// 更新下一次查询时间的显示
let nextQueryTime = null; // 用于存储下一次查询的时间

function updateNextQueryTime() {
    if (nextQueryTime) {
        clearTimeout(nextQueryTime); // 清除之前的定时器
    }

    const timeUntilNextQuery = getTimeUntilNextGMT2Midnight();
    nextQueryTime = new Date(Date.now() + timeUntilNextQuery);
    nextQueryElement.textContent = `Next query at: ${nextQueryTime.toLocaleString()}`;
}

// 每秒更新倒计时
function updateNextQueryCountdown() {
    if (nextQueryTime) {
        const now = new Date();
        const timeDiff = Math.max(0, nextQueryTime - now); // 计算剩余时间（毫秒）
        const hours = Math.floor(timeDiff / (1000 * 60 * 60));
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
        nextQueryElement.textContent = `Next query in: ${hours}h ${minutes}m ${seconds}s`;
    }
}

// 检查并更新数据的函数
function checkAndUpdateRateSheet() {
    const lastUpdatedDate = localStorage.getItem("rate_sheet_last_updated");
    const currentDate = getCurrentDateInGMT2();

    if (lastUpdatedDate === currentDate) {
        // 如果日期相同，直接使用 localStorage 中的数据
        const storedRateSheet = localStorage.getItem("rate_sheet");
        if (storedRateSheet) {
            rate_sheet = JSON.parse(storedRateSheet);
            console.log("Loaded from localStorage:", rate_sheet);
            display(rate_sheet); // 更新 HTML
        } else {
            console.error("No rate_sheet found in localStorage.");
        }
    } else {
        // 如果日期不同，发起 fetch 请求更新数据
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
                localStorage.setItem("rate_sheet_last_updated", currentDate);
                console.log("Updated and saved to localStorage:", rate_sheet);

                display(rate_sheet); // 更新 HTML
            })
            .catch((error) => {
                console.error("Error fetching data:", error);

                // 创建一个提示框元素
                const errorElement = document.createElement("div");
                errorElement.className = "error-popup"; // 添加类名
                errorElement.textContent = "CRITAL: Failed to fetch exchange rates. Exchange rate table expired. Please try again later.";

                // 将提示框添加到页面
                document.body.appendChild(errorElement);

                //  10分钟后移除提示框
                setTimeout(() => {
                    errorElement.remove();
                }, 600000);
            });
    }

    // 更新下一次查询时间
    updateNextQueryTime();

    // 设置下一次查询的定时器
    const timeUntilNextQuery = getTimeUntilNextGMT2Midnight();
    setTimeout(checkAndUpdateRateSheet, timeUntilNextQuery);
}

// 定义一个函数来将 rate_sheet 显示在 HTML 页面上
function display(rateSheet) {
    // 清空当前的内容
    outputElement.innerHTML = "<h2>Exchange Rates</h2>";
    const list = document.createElement("ul");
    const fragment = document.createDocumentFragment(); // 创建文档片段

    // 遍历 rateSheet 并仅显示 target 中的货币
    for (const [cur, rate] of Object.entries(rateSheet)) {
        if (target_buffer_rate[cur] !== undefined) {
            const listItem = document.createElement("li");
            listItem.className = "rate-item";
            listItem.textContent = `${source} : ${cur} = ${(rate + target_buffer_rate[cur]).toFixed(digits)}`;
            fragment.appendChild(listItem); // 添加到文档片段
        }
    }

    list.appendChild(fragment); // 一次性添加到列表
    outputElement.appendChild(list); // 更新 HTML
}

// 初始检查并更新
checkAndUpdateRateSheet();

// 每秒更新倒计时
setInterval(updateNextQueryCountdown, 1000);

