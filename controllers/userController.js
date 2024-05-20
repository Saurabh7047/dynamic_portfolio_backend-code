import { catchAsyncErrors } from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../middlewares/error.js";
import { User } from "../models/userSchema.js";
import { v2 as cloudinary } from "cloudinary";
import { generateToken } from "../utils/jwtTokens.js";
import { sendEmail } from "../utils/sendEmail.js";

export const register = catchAsyncErrors(async (req, res, next) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    return next(new ErrorHandler("Image And resume Required!", 400));
  }
  const { image, resume } = req.files;
  const cloudinaryImage = await cloudinary.uploader.upload(image.tempFilePath, {
    folder: "Images",
  });
  if (!cloudinaryImage || cloudinaryImage.error) {
    console.error(
      "Cloudinary Error: ",
      cloudinaryImage.error || "Unknown Cloudinary Error"
    );
  }
  const cloudinaryResume = await cloudinary.uploader.upload(
    resume.tempFilePath,
    {
      folder: "Resume",
    }
  );
  if (!cloudinaryResume || cloudinaryResume.error) {
    console.error(
      "Cloudinary Error: ",
      cloudinaryResume.error || "Unknown Cloudinary Error"
    );
  }

  const {
    fullName,
    email,
    phone,
    aboutMe,
    password,
    posrtfolioURL,
    githubURL,
    instagramURL,
    twitterURL,
    facebookURL,
    linkdinURL,
  } = req.body;

  const user = await User.create({
    fullName,
    email,
    phone,
    aboutMe,
    password,
    posrtfolioURL,
    githubURL,
    twitterURL,
    instagramURL,
    facebookURL,
    linkdinURL,
    image: {
      public_id: cloudinaryImage.public_id,
      url: cloudinaryImage.secure_url,
    },
    resume: {
      public_id: cloudinaryResume.public_id,
      url: cloudinaryResume.secure_url,
    },
  });
  generateToken(user, "User Registered!", 201, res);
});

export const login = catchAsyncErrors(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return next(new ErrorHandler("Email and Password are Required!"));
  }
  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    return next(new ErrorHandler("Invalid Email or Password!"));
  }

  const isMatched = await user.comparePassword(password);
  if (!isMatched) {
    return next(new ErrorHandler("Invalid Email or Password!"));
  }
  generateToken(user, "Logged In", 200, res);
});

export const logout = catchAsyncErrors(async (req, res, next) => {
  res
    .status(200)
    .cookie("token", "", {
      expires: new Date(Date.now()),
      httpOnly: true,
      sameSite:"None",
      secure:true,
    })
    .json({
      success: true,
      message: "Logged Out",
    });
});

export const getUser = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  res.status(200).json({
    success: true,
    user,
  });
});

export const updateProfile = catchAsyncErrors(async (req, res, next) => {
  const newUserData = {
    fullName: req.body.fullName,
    email: req.body.email,
    phone: req.body.phone,
    aboutMe: req.body.aboutMe,
    githubURL: req.body.githubURL,
    instagramURL: req.body.instagramURL,
    portfolioURL: req.body.portfolioURL,
    facebookURL: req.body.facebookURL,
    twitterURL:req.body.twitterURL,
    linkedInURL: req.body.linkedInURL,
  };
  if (req.files && req.files.image) {
    const image = req.files.image;
    const user = await User.findById(req.user.id);
    const profileImageId = user.image.public_id;
    await cloudinary.uploader.destroy(profileImageId);
    const newProfileImage = await cloudinary.uploader.upload(
      image.tempFilePath,
      {
        folder: "Images",
      }
    );
    newUserData.image = {
      public_id: newProfileImage.public_id,
      url: newProfileImage.secure_url,
    };
  }

  if (req.files && req.files.resume) {
    const resume = req.files.resume;
    const user = await User.findById(req.user.id);
    const resumeFileId = user.resume.public_id;
    if (resumeFileId) {
      await cloudinary.uploader.destroy(resumeFileId);
    }
    const newResume = await cloudinary.uploader.upload(resume.tempFilePath, {
      folder: "Resume",
    });
    newUserData.resume = {
      public_id: newResume.public_id,
      url: newResume.secure_url,
    };
  }

  const user = await User.findByIdAndUpdate(req.user.id, newUserData, {
    new: true,
    runValidators: true,
    useFindAndModify: false,
  });
  res.status(200).json({
    success: true,
    message: "Profile Updated!",
    user,
  });
});

export const updatePassword = catchAsyncErrors(async (req, res, next) => {
  const { currentPassword, newPassword, confirmNewPassword } = req.body;
  const user = await User.findById(req.user.id).select("+password");
  if (!currentPassword || !newPassword || !confirmNewPassword) {
    return next(new ErrorHandler("Please Fill All Fields.", 400));
  }
  const isPasswordMatched = await user.comparePassword(currentPassword);
  if (!isPasswordMatched) {
    return next(new ErrorHandler("Incorrect Current Password!"));
  }
  if (newPassword !== confirmNewPassword) {
    return next(
      new ErrorHandler("New Password And Confirm New Password Do Not Match!")
    );
  }
  user.password = newPassword;
  await user.save();
  res.status(200).json({
    success: true,
    message: "Password Updated!",
  });
});

export const getUserForPortfolio = catchAsyncErrors(async (req, res, next) => {
  const id = "6648d30a7d7140d516e17d1d";
  const user = await User.findById(id);
  res.status(200).json({
    success: true,
    user,
  });
});

//FORGOT PASSWORD
export const forgotPassword = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new ErrorHandler("User Not Found!", 404));
  }
  const resetToken = user.getResetPasswordToken();

  await user.save({ validateBeforeSave: false });

  const resetPasswordUrl = `${process.env.DASHBOARD_URL}/password/reset/${resetToken}`;

  const message = `Your Reset Password Token is:- \n\n ${resetPasswordUrl}  \n\n If 
  You've not requested this email then, please ignore it.`;

  try {
    await sendEmail({
      email: user.email,
      subject: `Personal Portfolio Dashboard Password Recovery`,
      message,
    });
    res.status(201).json({
      success: true,
      message: `Email sent to ${user.email} successfully`,
    });
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new ErrorHandler(error.message, 500));
  }
});

//RESET PASSWORD
export const resetPassword = catchAsyncErrors(async (req, res, next) => {
  const { token } = req.params;
  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  });
  if (!user) {
    return next(
      new ErrorHandler(
        "Reset password token is invalid or has been expired.",
        400
      )
    );
  }

  if (req.body.password !== req.body.confirmPassword) {
    return next(new ErrorHandler("Password & Confirm Password do not match"));
  }
  user.password = await req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;

  await user.save();

  generateToken(user, "Reset Password Successfully!", 200, res);
});
