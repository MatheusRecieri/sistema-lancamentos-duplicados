import PropTypes from 'prop-types';
import React from 'react';

//propriedade do componente {OBJ}
// props do titulo {string}

function Header({ title }) {
  return (
    <header className="text-center mb-10">
      <h1 className="text-3xl md:text-4xl font-bold text-white mb-6 tracking-wide drop-shadow-lg">
        {title}
      </h1>
      <nav>
        <ul className="flex justify-center space-x-8">
          {['Upload', 'Resultados', 'Sobre'].map((item, i) => (
            <li key={i}>
              <a
                href={`#${item.toLowerCase()}`}
                className="text-white/80 hover:text-[#f28c28] transition-colors duration-200 font-medium"
              >
                {item}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

Header.propTypes = {
  title: PropTypes.string.isRequired,
};

export default Header;
