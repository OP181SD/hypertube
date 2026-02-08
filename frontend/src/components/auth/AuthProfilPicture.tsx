import { useState } from "react";

interface Props {
    onContinue: () => void;
}

export const AuthProfilPicture: React.FC<Props> = ({ onContinue }) => {
    const generateRandomAvatar = () =>
        `https://randomuser.me/api/portraits/${Math.random() < 0.5 ? "men" : "women"
        }/${Math.floor(Math.random() * 100)}.jpg`;

    const [avatar, setAvatar] = useState(generateRandomAvatar);
    const [isHover, setIsHover] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAvatar(URL.createObjectURL(file));
        }
    };

    return (
        <div className="flex flex-col items-center justify-center gap-10 px-16 py-20 bg-[#1c1c1e] h-full text-center">

            <div className="space-y-3">
                <h2 className="text-[#f5f5f7] text-3xl font-medium tracking-tight">
                    Add a profile picture
                </h2>
                <p className="text-[#86868b] text-base max-w-md leading-relaxed">
                    A profile picture helps friends recognize you and personalizes your
                    experience across HyperTube.
                </p>
            </div>

            <div className="flex flex-col items-center gap-3">
                <label
                    className="relative cursor-pointer group"
                    onMouseEnter={() => setIsHover(true)}
                    onMouseLeave={() => setIsHover(false)}
                >
                    <div
                        className={`border-gradient rounded-full p-0.75 transition-transform duration-300
      ${isHover ? "scale-105" : ""}`}
                    >
                        <img
                            src={avatar}
                            alt="Profile Avatar"
                            className="w-40 h-40 rounded-full object-cover bg-[#1c1c1e]"
                        />
                    </div>

                    <div
                        className={`absolute inset-0 rounded-full bg-black/40 flex items-center justify-center text-white text-sm font-medium transition-opacity
      ${isHover ? "opacity-100" : "opacity-0"}`}
                    >
                        Change photo
                    </div>

                    <input
                        type="file"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={handleFileChange}
                    />

                    <div className="absolute bottom-1 right-1 bg-[#0071e3] w-10 h-10 rounded-full flex items-center justify-center text-white text-lg font-semibold border-2 border-[#1c1c1e]">
                        +
                    </div>
                </label>


                <p className="text-xs text-[#8e8e93]">
                    JPG or PNG • Square images work best
                </p>
            </div>

            <div className="flex gap-5 mt-2">
                <button
                    onClick={() => setAvatar(generateRandomAvatar())}
                    className="px-7 py-2 rounded-full bg-[#2c2c2e] text-[#f5f5f7] text-sm hover:bg-[#3a3a3c] transition"
                >
                    Use a random photo
                </button>

                <button
                    onClick={onContinue}
                    className="px-10 py-2.5 rounded-full bg-[#0071e3] text-white text-sm font-medium hover:bg-[#0077ed] transition"
                >
                    Continue
                </button>
            </div>

            <button
                onClick={onContinue}
                className="mt-2 text-xs text-[#8e8e93] hover:text-[#f5f5f7] transition"
            >
                Skip for now
            </button>
        </div>
    );
};
