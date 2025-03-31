// 全局变量定义
const digits = 4; // 小数点保留位数
let apikey = ""; // API 密钥
let source = ""; // 基准货币
let rate_sheet = null; // 汇率表数据
let buying_buffer_rate = {}; // 基准买入缓冲汇率
let selling_buffer_rate = {}; // 基准卖出缓冲汇率
let curency_desc_dict = {}; // 货币描述字典
let USD_CNY_desc = ""; // 美元兑人民币描述
let USD_CNY_buying_buffer_rate = null; // 美元兑人民币买入缓冲汇率
let USD_CNY_selling_buffer_rate = null; // 美元兑人民币卖出缓冲汇率
let SPEC_AUD_CNY_desc = ""; // 澳元兑人民币描述
let SPEC_AUD_CNY_buying_buffer_rate = null; // 澳元兑人民币买入缓冲汇率
let SPEC_AUD_CNY_selling_buffer_rate = null; // 澳元兑人民币卖出缓冲汇率
let countdownTimeoutId = null; // 倒计时定时器 ID

const outputElement = document.createElement("div"); // 汇率表容器
outputElement.id = "rateSheetContainer";
document.body.appendChild(outputElement);

/**
 * 加载配置文件
 * @returns {Promise<void>}
 */
function loadConfig() {
    return fetch(`config.json?timestamp=${new Date().getTime()}`)
        .then((response) => {
            if (!response.ok) throw new Error("Failed to load config.json");
            return response.json();
        })
        .then((data) => {
            apikey = data.apikey;
            source = data.source;
            buying_buffer_rate = data.AUD_buying_buffer_rates;
            selling_buffer_rate = data.AUD_selling_buffer_rates;
            curency_desc_dict = data.curency_desc;
            USD_CNY_desc = data.USD_CNY_desc;
            USD_CNY_buying_buffer_rate = data.USD_CNY_buying_buffer_rate;
            USD_CNY_selling_buffer_rate = data.USD_CNY_selling_buffer_rate;
            SPEC_AUD_CNY_desc = data.SEPC_AUD_CNY_desc;
            SPEC_AUD_CNY_buying_buffer_rate = data.SEPC_AUD_CNY_buying_buffer_rate;
            SPEC_AUD_CNY_selling_buffer_rate = data.SEPC_AUD_CNY_selling_buffer_rate;

            console.log("Config loaded:", { apikey, source, buying_buffer_rate, selling_buffer_rate });
        })
        .catch((error) => console.error("Error loading config:", error));
}

/**
 * 检查并更新汇率表数据
 */
function checkAndUpdateRateSheet() {
    const lastUpdatedTimestamp = localStorage.getItem("rate_sheet_last_updated");
    const now = Date.now();

    // 使用 localStorage 数据（10 分钟内有效）
    if (lastUpdatedTimestamp && now - parseInt(lastUpdatedTimestamp, 10) < 10 * 60 * 1000) {
        const storedRateSheet = localStorage.getItem("rate_sheet");
        if (storedRateSheet) {
            rate_sheet = JSON.parse(storedRateSheet);
            console.log("Loaded rate_sheet from localStorage:", rate_sheet);
            display(rate_sheet);
            return;
        }
    }

    // 从 API 获取最新数据
    fetch(`https://v6.exchangerate-api.com/v6/${encodeURIComponent(apikey)}/latest/${encodeURIComponent(source)}`)
        .then((response) => {
            if (!response.ok) throw new Error("Failed to fetch exchange rates.");
            return response.json();
        })
        .then((data) => {
            rate_sheet = data.conversion_rates;
            localStorage.setItem("rate_sheet", JSON.stringify(rate_sheet));
            localStorage.setItem("rate_sheet_last_updated", Date.now().toString());
            console.log("Updated rate_sheet:", rate_sheet);
            display(rate_sheet);
        })
        .catch((error) => {
            console.error("Error fetching data:", error);
            const errorElement = document.createElement("div");
            errorElement.className = "error-popup";
            errorElement.textContent = "Failed to fetch exchange rates. Please try again later.";
            document.body.appendChild(errorElement);
            setTimeout(() => errorElement.remove(), 600000);
        });
}

/**
 * 显示特殊汇率表
 * @param {Object} rateSheet - 汇率表数据
 */
function displaySpecialRates(rateSheet) {
    const table_spec = document.createElement("table");
    table_spec.className = "rate-table spec-rate-table";

    const thead_spec = document.createElement("thead");
    const headerRow_spec = document.createElement("tr");

    ["汇率对 Exchange Pairs", "买入价 Buy Price", "卖出价 Sell Price"].forEach((text) => {
        const th = document.createElement("th");
        th.textContent = text;
        headerRow_spec.appendChild(th);
    });

    thead_spec.appendChild(headerRow_spec);
    table_spec.appendChild(thead_spec);

    const tbody_spec = document.createElement("tbody");

    if (rateSheet["CNY"] !== undefined) {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${SPEC_AUD_CNY_desc}</td>
            <td>${(rateSheet["CNY"] - SPEC_AUD_CNY_buying_buffer_rate).toFixed(digits)}</td>
            <td>${(rateSheet["CNY"] + SPEC_AUD_CNY_selling_buffer_rate).toFixed(digits)}</td>
        `;
        tbody_spec.appendChild(row);
    }

    table_spec.appendChild(tbody_spec);
    return table_spec;
}

/**
 * 显示实时汇率表
 * @param {Object} rateSheet - 汇率表数据
 */
function displayRealTimeRates(rateSheet) {
    const table = document.createElement("table");
    table.className = "rate-table regu-rate-table";

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    ["汇率对 Exchange Pairs", "买入价 Buy Price", "卖出价 Sell Price"].forEach((text) => {
        const th = document.createElement("th");
        th.textContent = text;
        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    for (const [cur, rate] of Object.entries(rateSheet)) {
        if (selling_buffer_rate[cur] !== undefined) {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${curency_desc_dict[source]} / ${curency_desc_dict[cur]}</td>
                <td>${(rate - buying_buffer_rate[cur]).toFixed(digits)}</td>
                <td>${(rate + selling_buffer_rate[cur]).toFixed(digits)}</td>
            `;
            tbody.appendChild(row);
        }
    }

    // 美元兑人民币特殊行
    const row_USD_CNY = document.createElement("tr");
    row_USD_CNY.innerHTML = `
        <td>${USD_CNY_desc}</td>
        <td>${(rateSheet["CNY"] / rateSheet["USD"] - USD_CNY_buying_buffer_rate).toFixed(digits)}</td>
        <td>${(rateSheet["CNY"] / rateSheet["USD"] + USD_CNY_selling_buffer_rate).toFixed(digits)}</td>
    `;
    tbody.appendChild(row_USD_CNY);

    table.appendChild(tbody);
    return table;
}

/**
 * 显示汇率表数据
 * @param {Object} rateSheet - 汇率表数据
 */
function display(rateSheet) {
    outputElement.innerHTML = "";

    const specialRatesHeader = document.createElement("h2");
    specialRatesHeader.textContent = "VIP汇率 VIP Rate";
    outputElement.appendChild(specialRatesHeader);
    outputElement.appendChild(displaySpecialRates(rateSheet));

    const realTimeRatesHeader = document.createElement("h2");
    realTimeRatesHeader.textContent = "实时汇率 Live Rate";
    outputElement.appendChild(realTimeRatesHeader);
    outputElement.appendChild(displayRealTimeRates(rateSheet));
}

/**
 * 定时检查并更新汇率表数据
 */
function scheduleNextCheck() {
    checkAndUpdateRateSheet();
        setTimeout(scheduleNextCheck, 10 * 60 * 1000);
        console.log("Perfroming Scheduled Check");
}

// 初始化
loadConfig().then(() => {
    checkAndUpdateRateSheet();
    setTimeout(scheduleNextCheck, 10 * 60 * 1000);
});

