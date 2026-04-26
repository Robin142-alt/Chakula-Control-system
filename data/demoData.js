export const MEAL_ORDER = ["BREAKFAST", "LUNCH", "DINNER"];

export const ROLE_ACCESS = {
  STOREKEEPER: ["dashboard", "issue-stock", "inventory", "stock-count", "backfill-import", "reports"],
  COOK: ["dashboard", "log-leftovers", "inventory", "backfill-import", "reports"],
  ACCOUNTANT: ["dashboard", "inventory", "reports"],
  PRINCIPAL: ["dashboard"],
  ADMIN: ["dashboard", "inventory", "reports"],
};

export const USERS = [
  {
    id: 1,
    full_name: "Grace Wanjiku",
    role: "STOREKEEPER",
    display_name: "Grace - Storekeeper",
    pin_label: "Kitchen PIN",
    is_active: true,
    must_rotate_pin: false,
    created_by: 5,
  },
  {
    id: 2,
    full_name: "Peter Otieno",
    role: "COOK",
    display_name: "Peter - Cook",
    pin_label: "Kitchen PIN",
    is_active: true,
    must_rotate_pin: false,
    created_by: 5,
  },
  {
    id: 3,
    full_name: "Mary Njeri",
    role: "ACCOUNTANT",
    display_name: "Mary - Accountant",
    pin_label: "Office PIN",
    is_active: true,
    must_rotate_pin: false,
    created_by: 5,
  },
  {
    id: 4,
    full_name: "Mr. Kibet",
    role: "PRINCIPAL",
    display_name: "Mr. Kibet - Principal",
    pin_label: "Office PIN",
    is_active: true,
    must_rotate_pin: false,
    created_by: 5,
  },
  {
    id: 5,
    full_name: "Admin Achieng",
    role: "ADMIN",
    display_name: "Admin Achieng",
    pin_label: "Admin PIN",
    is_active: true,
    must_rotate_pin: false,
    created_by: 5,
  },
];

export const INVENTORY_ITEMS = [
  {
    id: 101,
    name: "Maize flour",
    sku: "MF-001",
    unit: "kg",
    category: "staple",
    current_stock: 620,
    reorder_level: 120,
    unit_cost_kes: 68,
    raw_input_text: "12 bags maize flour plus open sack",
    notes: "Main ugali and porridge stock",
    created_by: 5,
  },
  {
    id: 102,
    name: "Beans",
    sku: "BN-001",
    unit: "kg",
    category: "protein",
    current_stock: 340,
    reorder_level: 90,
    unit_cost_kes: 135,
    raw_input_text: "8 bags beans from Eldoret supplier",
    notes: "Dry beans for lunch and dinner",
    created_by: 5,
  },
  {
    id: 103,
    name: "Rice",
    sku: "RC-001",
    unit: "kg",
    category: "staple",
    current_stock: 300,
    reorder_level: 80,
    unit_cost_kes: 150,
    raw_input_text: "6 bags rice in back store",
    notes: "Dinner rice stock",
    created_by: 5,
  },
  {
    id: 104,
    name: "Cooking oil",
    sku: "OL-001",
    unit: "litres",
    category: "cooking",
    current_stock: 95,
    reorder_level: 25,
    unit_cost_kes: 310,
    raw_input_text: "4 jerricans oil in kitchen cage",
    notes: "Shared across meals",
    created_by: 5,
  },
];

export const DAY_SCENARIOS = [
  {
    date: "2026-04-20",
    student_count: 158,
    issue_scale: 1,
    expected_scale: 1,
    scenario: "normal_with_missing_dinner_leftover",
    missing_leftover_meals: ["DINNER"],
  },
  {
    date: "2026-04-21",
    student_count: 160,
    issue_scale: 1.02,
    expected_scale: 1,
    scenario: "duplicate_beans_issue",
    duplicate_issue: { meal_type: "LUNCH", item_id: 102, quantity: 6.5 },
    missing_leftover_meals: [],
  },
  {
    date: "2026-04-22",
    student_count: 162,
    issue_scale: 0.97,
    expected_scale: 1.01,
    scenario: "missing_lunch_leftover",
    missing_leftover_meals: ["LUNCH"],
  },
  {
    date: "2026-04-23",
    student_count: 170,
    issue_scale: 1.28,
    expected_scale: 1.06,
    scenario: "high_consumption_sports_day",
    missing_leftover_meals: [],
  },
  {
    date: "2026-04-24",
    student_count: 150,
    issue_scale: 0.78,
    expected_scale: 0.96,
    scenario: "low_consumption_day",
    missing_leftover_meals: ["BREAKFAST"],
  },
  {
    date: "2026-04-25",
    student_count: 159,
    issue_scale: 1.03,
    expected_scale: 1,
    scenario: "stock_mismatch_day",
    missing_leftover_meals: [],
  },
  {
    date: "2026-04-26",
    student_count: 161,
    issue_scale: 1.05,
    expected_scale: 1.01,
    scenario: "normal_today",
    missing_leftover_meals: [],
  },
];

const BASE_EXPECTED = {
  BREAKFAST: {
    101: 8,
  },
  LUNCH: {
    101: 26,
    102: 17,
    104: 3.2,
  },
  DINNER: {
    102: 12,
    103: 22,
    104: 2.6,
  },
};

const BASE_LEFTOVERS = {
  BREAKFAST: {
    101: 0.9,
  },
  LUNCH: {
    102: 1.8,
  },
  DINNER: {
    103: 1.4,
  },
};

function roundValue(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function itemById(itemId) {
  return INVENTORY_ITEMS.find((item) => item.id === itemId);
}

function buildDateTime(date, mealType, variant = "main") {
  const timeMap = {
    BREAKFAST: variant === "leftover" ? "09:20:00" : "06:40:00",
    LUNCH: variant === "leftover" ? "14:15:00" : "10:55:00",
    DINNER: variant === "leftover" ? "20:10:00" : "16:35:00",
    COUNT: "18:15:00",
    STUDENTS: "05:50:00",
  };
  return `${date}T${timeMap[mealType] || timeMap.COUNT}+03:00`;
}

function scaleQuantity(quantity, studentCount, scenarioScale) {
  const studentFactor = studentCount / 160;
  return roundValue(quantity * studentFactor * scenarioScale);
}

function buildStudentCounts() {
  return DAY_SCENARIOS.map((day, index) => ({
    id: 1001 + index,
    count_date: day.date,
    date_time: buildDateTime(day.date, "STUDENTS"),
    meal_type: "ALL",
    student_count: day.student_count,
    raw_input_text: `${day.student_count} students present after morning roll call`,
    notes: `Shared boarding count for ${day.scenario.replaceAll("_", " ")}`,
    created_by: 5,
    entered_late: false,
    conflict_flag: false,
  }));
}

function buildExpectedUsage() {
  let idCounter = 2001;
  return DAY_SCENARIOS.flatMap((day) =>
    MEAL_ORDER.flatMap((mealType) =>
      Object.entries(BASE_EXPECTED[mealType]).map(([itemId, quantity]) => ({
        id: idCounter++,
        item_id: Number(itemId),
        meal_type: mealType,
        usage_date: day.date,
        date_time: buildDateTime(day.date, mealType),
        expected_quantity: scaleQuantity(quantity, day.student_count, day.expected_scale),
        unit: itemById(Number(itemId)).unit,
        expected_students: day.student_count,
        basis: "student-count-plan",
        raw_input_text: `Planned from ${day.student_count} students`,
        notes: `Expected ${mealType.toLowerCase()} usage`,
        created_by: 5,
        entered_late: false,
        conflict_flag: false,
      })),
    ),
  );
}

function buildIssueLogs() {
  let idCounter = 3001;
  const logs = [];

  DAY_SCENARIOS.forEach((day) => {
    MEAL_ORDER.forEach((mealType) => {
      Object.entries(BASE_EXPECTED[mealType]).forEach(([itemId, quantity]) => {
        const numericItemId = Number(itemId);
        const item = itemById(numericItemId);
        const scaledQuantity = scaleQuantity(quantity, day.student_count, day.issue_scale);

        logs.push({
          id: idCounter++,
          item_id: numericItemId,
          item_name_snapshot: item.name,
          quantity: scaledQuantity,
          unit: item.unit,
          raw_input_text: `${scaledQuantity} ${item.unit} ${item.name.toLowerCase()} for ${mealType.toLowerCase()}`,
          meal_type: mealType,
          date_time: buildDateTime(day.date, mealType),
          notes: `Issued for ${mealType.toLowerCase()} during ${day.scenario.replaceAll("_", " ")}`,
          created_by: 1,
          expected_students: day.student_count,
          entered_late: day.date === "2026-04-22" && mealType === "DINNER",
          conflict_flag: false,
        });
      });
    });

    if (day.duplicate_issue) {
      const item = itemById(day.duplicate_issue.item_id);
      logs.push({
        id: idCounter++,
        item_id: day.duplicate_issue.item_id,
        item_name_snapshot: item.name,
        quantity: day.duplicate_issue.quantity,
        unit: item.unit,
        raw_input_text: "extra 1 debe beans written later on paper",
        meal_type: day.duplicate_issue.meal_type,
        date_time: `${day.date}T11:20:00+03:00`,
        notes: "Second paper entry captured after lunch rush",
        created_by: 1,
        expected_students: day.student_count,
        entered_late: true,
        conflict_flag: false,
      });
    }
  });

  return logs;
}

function buildLeftoverLogs() {
  let idCounter = 4001;
  const logs = [];

  DAY_SCENARIOS.forEach((day) => {
    MEAL_ORDER.forEach((mealType) => {
      if (day.missing_leftover_meals.includes(mealType)) {
        return;
      }

      const [itemId, quantity] = Object.entries(BASE_LEFTOVERS[mealType])[0];
      const numericItemId = Number(itemId);
      const item = itemById(numericItemId);

      logs.push({
        id: idCounter++,
        item_id: numericItemId,
        item_name_snapshot: item.name,
        quantity: scaleQuantity(quantity, day.student_count, 1),
        unit: item.unit,
        raw_input_text:
          mealType === "LUNCH"
            ? "small sufuria beans remained"
            : `${item.name.toLowerCase()} leftover recorded after ${mealType.toLowerCase()}`,
        meal_type: mealType,
        date_time: buildDateTime(day.date, mealType, "leftover"),
        notes: `Leftover entry for ${mealType.toLowerCase()}`,
        created_by: 2,
        entered_late: day.date === "2026-04-24" && mealType === "DINNER",
        conflict_flag: false,
      });
    });
  });

  return logs;
}

function buildStockCounts() {
  return [
    {
      id: 5001,
      item_id: 102,
      counted_quantity: 206,
      system_quantity: 205.2,
      variance_quantity: 0.8,
      unit: "kg",
      raw_input_text: "beans almost match book balance",
      meal_type: null,
      date_time: "2026-04-22T18:20:00+03:00",
      notes: "Routine mid-week count",
      created_by: 1,
      entered_late: false,
      conflict_flag: false,
    },
    {
      id: 5002,
      item_id: 102,
      counted_quantity: 118,
      system_quantity: 136,
      variance_quantity: -18,
      unit: "kg",
      raw_input_text: "beans sacks lighter than bin card",
      meal_type: null,
      date_time: "2026-04-25T18:35:00+03:00",
      notes: "Mismatch noticed during Friday count",
      created_by: 1,
      entered_late: false,
      conflict_flag: false,
    },
    {
      id: 5003,
      item_id: 104,
      counted_quantity: 31,
      system_quantity: 36.5,
      variance_quantity: -5.5,
      unit: "litres",
      raw_input_text: "oil less than expected in store cage",
      meal_type: null,
      date_time: "2026-04-25T18:40:00+03:00",
      notes: "Oil variance flagged",
      created_by: 1,
      entered_late: true,
      conflict_flag: false,
    },
  ];
}

export const STUDENT_COUNTS = buildStudentCounts();
export const EXPECTED_USAGE = buildExpectedUsage();
export const ISSUE_LOGS = buildIssueLogs();
export const LEFTOVER_LOGS = buildLeftoverLogs();
export const STOCK_COUNTS = buildStockCounts();

export const DEMO_DATA = {
  users: USERS,
  inventory_items: INVENTORY_ITEMS,
  student_counts: STUDENT_COUNTS,
  expected_usage: EXPECTED_USAGE,
  issue_logs: ISSUE_LOGS,
  leftover_logs: LEFTOVER_LOGS,
  stock_counts: STOCK_COUNTS,
};
