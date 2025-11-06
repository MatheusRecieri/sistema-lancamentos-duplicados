import PropTypes from 'prop-types';
import React from 'react';

//propriedade do componente {OBJ}
// props do titulo {string}

function Header({ title, onMenuItemClick }) {
  const handleClick = item => {
    if (onMenuItemClick) onMenuItemClick(item);
  }
  return (
    <header className="text-center mb-10">
      <h1 className="text-3xl md:text-4xl font-bold text-white mb-6 tracking-wide drop-shadow-lg">
        {title}
      </h1>
      <nav>
        <ul className="flex justify-center space-x-8">
          {['Upload', 'Resultados', 'Sobre'].map((item, i) => (
            <li key={i}>
              <button
                onClick={() => handleClick(item)} //chama a função ao clicar
                className="text-white/80 hover:text-primary[#f28c28] transition-colors duration-200 font-medium focus:outline-none"
              >
                {item}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
Header.propTypes = {
  title: PropTypes.string.isRequired,
  onMenuItemClick: PropTypes.func.isRequired
};

export default Header;
