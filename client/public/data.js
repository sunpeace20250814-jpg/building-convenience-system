/**
 * =========================================
 * MAIL LABEL SYSTEM v3.0
 * 郵件標籤產生器 - 資料模組
 * =========================================
 */

const MailLabelData = {

  // 預設寄件人資料（全域相同）
  DEFAULT_SENDER: {
    title: "寄件人",
    zip: "814",
    address: "高雄市仁武區霞海路101號1樓",
    name: "行樂日和大樓管理委員會",
    phone: "073103123"
  },

  // 預設收件人資料（範例）
  DEFAULT_RECIPIENT: {
    title: "收件人",
    unit: "A1-3F",
    name: "林冠婷",
    phone: "0920-522-735",
    address: "高雄市左營區博愛四路309號二十六樓之1"
  },

  // 標籤資料陣列 - 在此編輯所有標籤內容
  // 可新增、刪除、修改任何項目
  LABELS: [
    {
      header: "郵件標籤",
      sender: {
        title: "寄件人",
        zip: "814",
        address: "高雄市仁武區霞海路101號1樓",
        name: "行樂日和大樓管理委員會",
        phone: "073103123"
      },
      recipient: {
        title: "收件人",
        unit: "A1-3F",
        name: "林冠婷",
        phone: "0920-522-735",
        address: "高雄市左營區博愛四路309號二十六樓之1"
      }
    },
    {
      header: "郵件標籤",
      sender: {
        title: "寄件人",
        zip: "814",
        address: "高雄市仁武區霞海路101號1樓",
        name: "行樂日和大樓管理委員會",
        phone: "073103123"
      },
      recipient: {
        title: "收件人",
        unit: "A1-4F",
        name: "興連城建設有限公司",
        phone: "07-3456789",
        address: "高雄市左營區博愛四路309號二十六樓之2"
      }
    },
    {
      header: "郵件標籤",
      sender: {
        title: "寄件人",
        zip: "814",
        address: "高雄市仁武區霞海路101號1樓",
        name: "行樂日和大樓管理委員會",
        phone: "073103123"
      },
      recipient: {
        title: "收件人",
        unit: "B2-1F",
        name: "張大明",
        phone: "0911-222-333",
        address: "高雄市左營區博愛四路310號一樓"
      }
    },
    {
      header: "郵件標籤",
      sender: {
        title: "寄件人",
        zip: "814",
        address: "高雄市仁武區霞海路101號1樓",
        name: "行樂日和大樓管理委員會",
        phone: "073103123"
      },
      recipient: {
        title: "收件人",
        unit: "B2-2F",
        name: "李小美",
        phone: "0922-333-444",
        address: "高雄市左營區博愛四路310號二樓"
      }
    },
    {
      header: "郵件標籤",
      sender: {
        title: "寄件人",
        zip: "814",
        address: "高雄市仁武區霞海路101號1樓",
        name: "行樂日和大樓管理委員會",
        phone: "073103123"
      },
      recipient: {
        title: "收件人",
        unit: "B3-1F",
        name: "王小華",
        phone: "0933-444-555",
        address: "高雄市左營區博愛四路311號一樓"
      }
    },
    {
      header: "郵件標籤",
      sender: {
        title: "寄件人",
        zip: "814",
        address: "高雄市仁武區霞海路101號1樓",
        name: "行樂日和大樓管理委員會",
        phone: "073103123"
      },
      recipient: {
        title: "收件人",
        unit: "B3-2F",
        name: "陳小文",
        phone: "0944-555-666",
        address: "高雄市左營區博愛四路311號二樓"
      }
    }
  ]
};
