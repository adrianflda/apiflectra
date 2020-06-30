module.exports.getContact = async (flectra, elements) => {
  console.log(elements);
  const result = await flectra.existContact(elements);
  console.log(JSON.stringify(result));
};
