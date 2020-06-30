const Flectra = require("./flectra");
const main = new Flectra();

const init = async () => {
  await main.connect();
};

(async () => {
  await init();

  const { name, email, phone, mobile } = {
    name: "adrian",
    email: "",
    phone: "",
    mobile: "",
  };

  require("./respartner").getContact(main, { name, phone, mobile, email });
})();
