import mongoose from "mongoose";
const { Schema } = mongoose;


const schema = new Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    bar_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Bar'
    },
}, { timestamps: true });

const model = mongoose.model("UserLike", schema);
export const userLikeModel = model;

//@Function
const create = (data) => {
    return new Promise((resolve, reject) => {
      try {
        const newDocument = new model({
            user_id: data.userId,
            bar_id: data.barId,
        });
        newDocument
          .save()
          .then((createdDocument) => {
            resolve(createdDocument);
          })
          .catch((error) => {
            reject(error);
          });
      } catch (error) {
        reject(error);
      }
    });
  };

  const findOne = (filter) => {
    return new Promise((resolve, reject) => {
        try{
            model
            .findOne({...filter})
            .then((document) => {
                resolve(document)
            })
            .catch((error) => {
                reject(error);
            });
        }catch(error){
            reject(error);
        }
    })
  }

  const find = (filter, fields = null) => {
    return new Promise((resolve, reject) => {
      try {
        let query = model.find({ ...filter });
        
        if (fields) {
          query = query.select(fields);
        }
  
        query
          .then((documents) => {
            resolve(documents);
          })
          .catch((error) => {
            reject(error);
          });
      } catch (error) {
        reject(error);
      }
    });
  };

  const deleteOne = (filter) => {
    return new Promise((resolve, reject) => {
      try {
        model
          .deleteOne(filter)
          .then((result) => {
            if (!result.deletedCount) {
              resolve(false);
            } else {
              resolve(true);
            }
          })
          .catch((error) => {
            reject(error);
          });
      } catch (error) {
        reject(error);
      }
    });
  };
  
  const UserLike = {
    create, 
    findOne, 
    find, 
    deleteOne
  };
  export default UserLike;