
import { useTranslation } from "react-i18next";
import { MenuItem, Select } from "@mui/material";
import { availableLanguages } from "@/shared/locales";
import "./styles.scss";

export const SwitchLanguage = () => {
  const { i18n } = useTranslation();
  const handleLanguage = (e: { target: { value: string | undefined } }) => {
    void i18n.changeLanguage(e.target.value);
  };
  return (
    <Select
      variant="standard"
      id="translation-select"
      value={i18n.language}
      label="Status"
      onChange={handleLanguage}
    >
      {availableLanguages.map((language) => (
        <MenuItem
          className="translation-option"
          key={language.lang}
          value={language.lang}
          disabled={i18n.resolvedLanguage === language.lang}
        >
          {language.name}
        </MenuItem>
      ))}
    </Select>
  );
};

