import mongoose from 'mongoose';

const useDatabase = async () => {
  try {
    mongoose
    .connect(process.env.URL_MONGOOSE)
    .then(async () => {
      console.log('Kết nối thành công');
      // await seedDatabase();
    })
    .catch((error) => {
      console.log('Lỗi kết nối', error);
    });
  } catch (error) {
    console.log(error);
  }
};

export default useDatabase;


