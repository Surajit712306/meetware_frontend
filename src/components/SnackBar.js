import {useEffect} from 'react';
import './SnackBar.css';

function SnackBar({children, closeSnackBar}) {

    useEffect(() => {
        const id = setTimeout(() => {
            if(closeSnackBar)
            {
                closeSnackBar();
            }
        }, 2600);

        return () => {
            clearTimeout(id);
        }
    }, [closeSnackBar]);

    return (
        <div className="snack-bar">
            {children}         
        </div>
    );
}

export default SnackBar;
